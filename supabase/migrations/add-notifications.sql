-- ============================================
-- Add Notifications Table
-- ============================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'new-sale', 'stock-assigned', 'payment-delay', 'out-of-stock', 'sale-verified'
  related_id UUID, -- ID of related sale, stock, etc
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Function to create notification for TL when DSR creates a sale
CREATE OR REPLACE FUNCTION notify_tl_on_new_sale()
RETURNS TRIGGER AS $$
DECLARE
  tl_user_id UUID;
  dsr_name TEXT;
  stock_type_name TEXT;
BEGIN
  -- Get TL user_id from the sale's tl_id
  SELECT user_id INTO tl_user_id
  FROM team_leaders
  WHERE id = NEW.tl_id;

  -- Get DSR name
  SELECT p.full_name INTO dsr_name
  FROM dsrs d
  JOIN profiles p ON d.user_id = p.id
  WHERE d.id = NEW.dsr_id;

  -- Get stock type name
  stock_type_name := CASE NEW.sale_type
    WHEN 'FS' THEN 'Full Set'
    WHEN 'DO' THEN 'Decoder Only'
    ELSE NEW.sale_type
  END;

  -- Create notification for TL
  IF tl_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      tl_user_id,
      'New Sale Recorded',
      dsr_name || ' has recorded a new ' || stock_type_name || ' sale (' || NEW.sale_id || ')',
      'new-sale',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new sales
DROP TRIGGER IF EXISTS trigger_notify_tl_on_new_sale ON sales;
CREATE TRIGGER trigger_notify_tl_on_new_sale
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION notify_tl_on_new_sale();

-- Function to notify DSR when stock is assigned
CREATE OR REPLACE FUNCTION notify_dsr_on_stock_assignment()
RETURNS TRIGGER AS $$
DECLARE
  dsr_user_id UUID;
  stock_item_name TEXT;
BEGIN
  -- Only notify if status changed to assigned-dsr
  IF NEW.status = 'assigned-dsr' AND (OLD.status IS NULL OR OLD.status != 'assigned-dsr') THEN
    -- Get DSR user_id
    SELECT user_id INTO dsr_user_id
    FROM dsrs
    WHERE id = NEW.assigned_to_dsr;

    -- Get stock item name
    SELECT name INTO stock_item_name
    FROM stock_batches
    WHERE id = NEW.stock_item_id;

    -- Create notification for DSR
    IF dsr_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        dsr_user_id,
        'Stock Assigned',
        'You have been assigned ' || NEW.quantity::TEXT || ' units of ' || COALESCE(stock_item_name, 'stock'),
        'stock-assigned',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for stock assignment
DROP TRIGGER IF EXISTS trigger_notify_dsr_on_stock_assignment ON stock;
CREATE TRIGGER trigger_notify_dsr_on_stock_assignment
  AFTER INSERT OR UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION notify_dsr_on_stock_assignment();

-- Function to check for delayed payments (run periodically)
CREATE OR REPLACE FUNCTION check_payment_delays()
RETURNS void AS $$
DECLARE
  delayed_sale RECORD;
  tl_user_id UUID;
  dsr_name TEXT;
BEGIN
  -- Find sales that are unpaid for more than 7 days
  FOR delayed_sale IN
    SELECT s.*, d.user_id as dsr_user_id, tl.user_id as tl_user_id
    FROM sales s
    JOIN dsrs d ON s.dsr_id = d.id
    JOIN team_leaders tl ON s.tl_id = tl.id
    WHERE s.payment_status = 'unpaid'
    AND s.created_at < NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_id = s.id
      AND n.type = 'payment-delay'
      AND n.created_at > NOW() - INTERVAL '1 day'
    )
  LOOP
    -- Get DSR name
    SELECT p.full_name INTO dsr_name
    FROM profiles p
    WHERE p.id = delayed_sale.dsr_user_id;

    -- Notify TL
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      delayed_sale.tl_user_id,
      'Payment Delayed',
      'Sale ' || delayed_sale.sale_id || ' by ' || dsr_name || ' is overdue for payment',
      'payment-delay',
      delayed_sale.id
    );

    -- Notify DSR
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (
      delayed_sale.dsr_user_id,
      'Payment Reminder',
      'Payment for sale ' || delayed_sale.sale_id || ' is overdue',
      'payment-delay',
      delayed_sale.id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for low/out of stock
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS void AS $$
DECLARE
  stock_record RECORD;
  dsr_user_id UUID;
  tl_user_id UUID;
BEGIN
  -- Find DSRs with low stock (less than 5 units)
  FOR stock_record IN
    SELECT 
      d.id as dsr_id,
      d.user_id as dsr_user_id,
      tl.user_id as tl_user_id,
      SUM(s.quantity) as total_quantity
    FROM dsrs d
    JOIN team_leaders tl ON d.tl_id = tl.id
    LEFT JOIN stock s ON s.assigned_to_dsr = d.id AND s.status = 'assigned-dsr'
    GROUP BY d.id, d.user_id, tl.user_id
    HAVING SUM(s.quantity) < 5 OR SUM(s.quantity) IS NULL
  LOOP
    -- Check if notification already sent today
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = stock_record.tl_user_id
      AND type = 'out-of-stock'
      AND created_at > NOW() - INTERVAL '1 day'
      AND message LIKE '%' || stock_record.dsr_id::TEXT || '%'
    ) THEN
      -- Notify TL
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        stock_record.tl_user_id,
        'Low Stock Alert',
        'A DSR has ' || COALESCE(stock_record.total_quantity, 0)::TEXT || ' units remaining. Please assign more stock.',
        'out-of-stock',
        stock_record.dsr_id
      );
    END IF;

    -- Notify DSR if out of stock
    IF COALESCE(stock_record.total_quantity, 0) = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = stock_record.dsr_user_id
        AND type = 'out-of-stock'
        AND created_at > NOW() - INTERVAL '1 day'
      ) THEN
        INSERT INTO notifications (user_id, title, message, type, related_id)
        VALUES (
          stock_record.dsr_user_id,
          'Out of Stock',
          'You have no stock assigned. Contact your Team Leader.',
          'out-of-stock',
          stock_record.dsr_id
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
