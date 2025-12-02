-- ============================================
-- COMPLETE SYSTEM UPDATE MIGRATION
-- Includes: Notifications, Commission System, DSR Fields
-- IMPORTANT: Run step1-add-manager-role.sql FIRST!
-- ============================================

-- ============================================
-- PART 1: Add Missing DSR Fields
-- ============================================

-- Add dsr_number column
ALTER TABLE public.dsrs 
ADD COLUMN IF NOT EXISTS dsr_number TEXT;

-- Add territory column if not exists
ALTER TABLE public.dsrs 
ADD COLUMN IF NOT EXISTS territory TEXT;

-- Add tier column for commission tracking
ALTER TABLE public.dsrs
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'KURUTA';

-- Add index for dsr_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_dsrs_dsr_number ON public.dsrs(dsr_number);

-- Add comment to tier column
COMMENT ON COLUMN public.dsrs.tier IS 'DSR performance tier: KURUTA, CHUMA, SHABA, FEDHA, DHAHABU, TANZANITE';

-- ============================================
-- PART 2: Create Notifications System
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
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
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
BEGIN
  -- Only notify if status changed to assigned-dsr
  IF NEW.status = 'assigned-dsr' AND (OLD.status IS NULL OR OLD.status != 'assigned-dsr') THEN
    -- Get DSR user_id
    SELECT user_id INTO dsr_user_id
    FROM dsrs
    WHERE id = NEW.assigned_to_dsr;

    -- Create notification for DSR
    IF dsr_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, related_id)
      VALUES (
        dsr_user_id,
        'Stock Assigned',
        'You have been assigned new stock items',
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

-- Function to check for delayed payments (run periodically via cron)
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
  total_stock INT;
BEGIN
  -- Find DSRs with low stock (less than 5 units)
  FOR stock_record IN
    SELECT 
      d.id as dsr_id,
      d.user_id as dsr_user_id,
      tl.user_id as tl_user_id,
      COUNT(s.id) as total_quantity
    FROM dsrs d
    JOIN team_leaders tl ON d.tl_id = tl.id
    LEFT JOIN stock s ON s.assigned_to_dsr = d.id AND s.status = 'assigned-dsr'
    GROUP BY d.id, d.user_id, tl.user_id
    HAVING COUNT(s.id) < 5
  LOOP
    total_stock := stock_record.total_quantity;
    
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
        'A DSR has ' || COALESCE(total_stock, 0)::TEXT || ' units remaining. Please assign more stock.',
        'out-of-stock',
        stock_record.dsr_id
      );
    END IF;

    -- Notify DSR if out of stock
    IF COALESCE(total_stock, 0) = 0 THEN
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

-- ============================================
-- PART 3: Commission System
-- ============================================

-- Add commission tracking columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending-approval',
ADD COLUMN IF NOT EXISTS commission_reason TEXT,
ADD COLUMN IF NOT EXISTS upfront_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activation_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_commission NUMERIC(10, 2) DEFAULT 0;

-- Add check constraint for commission status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_commission_status'
  ) THEN
    ALTER TABLE public.sales
    ADD CONSTRAINT check_commission_status 
    CHECK (commission_status IN ('eligible', 'pending-approval', 'not-eligible'));
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.sales.commission_status IS 'Commission eligibility: eligible, pending-approval, not-eligible';
COMMENT ON COLUMN public.sales.commission_reason IS 'Reason if not eligible or pending';
COMMENT ON COLUMN public.sales.upfront_commission IS 'DO: 2,000 TZS, FS: 5,000 TZS';
COMMENT ON COLUMN public.sales.activation_commission IS 'Fixed 1,500 TZS per activation';
COMMENT ON COLUMN public.sales.package_commission IS 'Based on DSTV package selected';
COMMENT ON COLUMN public.sales.total_commission IS 'Total commission for this sale (excluding bonus)';

-- Create commission_payouts table for monthly bonus tracking
CREATE TABLE IF NOT EXISTS public.commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsr_id UUID NOT NULL REFERENCES public.dsrs(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  tier TEXT NOT NULL,
  monthly_sales_count INT NOT NULL,
  base_commission NUMERIC(12, 2) NOT NULL,
  bonus_commission NUMERIC(12, 2) NOT NULL,
  total_commission NUMERIC(12, 2) NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_dsr_month UNIQUE (dsr_id, month)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_commission_payouts_dsr_id ON public.commission_payouts(dsr_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_month ON public.commission_payouts(month);
CREATE INDEX IF NOT EXISTS idx_sales_commission_status ON public.sales(commission_status);
CREATE INDEX IF NOT EXISTS idx_sales_dsr_created ON public.sales(dsr_id, created_at);

-- Enable RLS
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_payouts
DROP POLICY IF EXISTS "DSRs can view their own commission payouts" ON public.commission_payouts;
CREATE POLICY "DSRs can view their own commission payouts"
  ON public.commission_payouts
  FOR SELECT
  USING (
    dsr_id IN (
      SELECT id FROM dsrs WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and Managers can view all commission payouts" ON public.commission_payouts;
CREATE POLICY "Admins and Managers can view all commission payouts"
  ON public.commission_payouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "System can insert commission payouts" ON public.commission_payouts;
CREATE POLICY "System can insert commission payouts"
  ON public.commission_payouts
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update commission payouts" ON public.commission_payouts;
CREATE POLICY "Admins can update commission payouts"
  ON public.commission_payouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to calculate and update commission for a sale
CREATE OR REPLACE FUNCTION calculate_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  upfront_amt NUMERIC(10, 2);
  activation_amt NUMERIC(10, 2);
  package_amt NUMERIC(10, 2);
BEGIN
  -- Calculate upfront commission based on sale type
  upfront_amt := CASE NEW.sale_type
    WHEN 'FS' THEN 5000
    WHEN 'DO' THEN 2000
    ELSE 0
  END;

  -- Activation commission (fixed for all)
  activation_amt := 1500;

  -- Package commission based on DSTV package
  package_amt := CASE UPPER(COALESCE(NEW.package_option, ''))
    WHEN 'PREMIUM' THEN 65000
    WHEN 'COMPACT PLUS' THEN 35000
    WHEN 'COMPACT' THEN 17000
    WHEN 'SHANGWE' THEN 6000
    WHEN 'ACCESS' THEN 2750
    WHEN 'BOMBA' THEN 2750
    ELSE 0
  END;

  -- Determine commission status
  -- For DVS (mapped to DO), unpaid is OK
  IF NEW.sale_type = 'DO' AND NEW.stock_id IS NULL THEN
    -- This is DVS (no stock_id means virtual)
    IF NEW.admin_approved = false THEN
      NEW.commission_status := 'not-eligible';
      NEW.commission_reason := 'Admin rejected';
      NEW.upfront_commission := 0;
      NEW.activation_commission := 0;
      NEW.package_commission := 0;
      NEW.total_commission := 0;
    ELSIF NEW.admin_approved IS NULL THEN
      NEW.commission_status := 'pending-approval';
      NEW.commission_reason := 'Awaiting admin approval';
      NEW.upfront_commission := upfront_amt;
      NEW.activation_commission := activation_amt;
      NEW.package_commission := package_amt;
      NEW.total_commission := upfront_amt + activation_amt + package_amt;
    ELSIF NEW.package_option IS NULL THEN
      NEW.commission_status := 'not-eligible';
      NEW.commission_reason := 'No package selected';
      NEW.upfront_commission := 0;
      NEW.activation_commission := 0;
      NEW.package_commission := 0;
      NEW.total_commission := 0;
    ELSE
      NEW.commission_status := 'eligible';
      NEW.commission_reason := NULL;
      NEW.upfront_commission := upfront_amt;
      NEW.activation_commission := activation_amt;
      NEW.package_commission := package_amt;
      NEW.total_commission := upfront_amt + activation_amt + package_amt;
    END IF;
  ELSIF NEW.payment_status = 'unpaid' THEN
    -- FS/DO with physical stock unpaid = not eligible
    NEW.commission_status := 'not-eligible';
    NEW.commission_reason := 'Stock unpaid';
    NEW.upfront_commission := 0;
    NEW.activation_commission := 0;
    NEW.package_commission := 0;
    NEW.total_commission := 0;
  ELSIF NEW.admin_approved = false THEN
    -- Admin rejected = not eligible
    NEW.commission_status := 'not-eligible';
    NEW.commission_reason := 'Admin rejected';
    NEW.upfront_commission := 0;
    NEW.activation_commission := 0;
    NEW.package_commission := 0;
    NEW.total_commission := 0;
  ELSIF NEW.admin_approved IS NULL THEN
    -- Awaiting approval = pending
    NEW.commission_status := 'pending-approval';
    NEW.commission_reason := 'Awaiting admin approval';
    NEW.upfront_commission := upfront_amt;
    NEW.activation_commission := activation_amt;
    NEW.package_commission := package_amt;
    NEW.total_commission := upfront_amt + activation_amt + package_amt;
  ELSIF NEW.package_option IS NULL THEN
    -- No package = not eligible
    NEW.commission_status := 'not-eligible';
    NEW.commission_reason := 'No package selected';
    NEW.upfront_commission := 0;
    NEW.activation_commission := 0;
    NEW.package_commission := 0;
    NEW.total_commission := 0;
  ELSE
    -- Eligible
    NEW.commission_status := 'eligible';
    NEW.commission_reason := NULL;
    NEW.upfront_commission := upfront_amt;
    NEW.activation_commission := activation_amt;
    NEW.package_commission := package_amt;
    NEW.total_commission := upfront_amt + activation_amt + package_amt;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate commission on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_calculate_sale_commission ON sales;
CREATE TRIGGER trigger_calculate_sale_commission
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_commission();

-- Function to generate monthly commission report
CREATE OR REPLACE FUNCTION generate_monthly_commission_report(target_month DATE)
RETURNS TABLE (
  dsr_id UUID,
  dsr_name TEXT,
  tier TEXT,
  monthly_sales INT,
  base_commission NUMERIC,
  bonus_commission NUMERIC,
  total_commission NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as dsr_id,
    p.full_name as dsr_name,
    d.tier,
    COUNT(s.id)::INT as monthly_sales,
    COALESCE(SUM(s.total_commission), 0) as base_commission,
    CASE d.tier
      WHEN 'KURUTA' THEN 
        CASE WHEN COUNT(s.id) BETWEEN 3 AND 4 THEN 30000 ELSE 0 END
      WHEN 'CHUMA' THEN 0
      WHEN 'SHABA' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 5 AND 9 THEN 50000
          WHEN COUNT(s.id) BETWEEN 10 AND 14 THEN 115000
          ELSE 0 
        END
      WHEN 'FEDHA' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 15 AND 19 THEN 200000
          WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 300000
          ELSE 0 
        END
      WHEN 'DHAHABU' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 425000
          WHEN COUNT(s.id) BETWEEN 25 AND 44 THEN 675000
          ELSE 0 
        END
      WHEN 'TANZANITE' THEN 
        CASE WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 1000000 ELSE 0 END
      ELSE 0
    END::NUMERIC as bonus_commission,
    COALESCE(SUM(s.total_commission), 0) + 
    CASE d.tier
      WHEN 'KURUTA' THEN 
        CASE WHEN COUNT(s.id) BETWEEN 3 AND 4 THEN 30000 ELSE 0 END
      WHEN 'CHUMA' THEN 0
      WHEN 'SHABA' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 5 AND 9 THEN 50000
          WHEN COUNT(s.id) BETWEEN 10 AND 14 THEN 115000
          ELSE 0 
        END
      WHEN 'FEDHA' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 15 AND 19 THEN 200000
          WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 300000
          ELSE 0 
        END
      WHEN 'DHAHABU' THEN 
        CASE 
          WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 425000
          WHEN COUNT(s.id) BETWEEN 25 AND 44 THEN 675000
          ELSE 0 
        END
      WHEN 'TANZANITE' THEN 
        CASE WHEN COUNT(s.id) BETWEEN 20 AND 24 THEN 1000000 ELSE 0 END
      ELSE 0
    END::NUMERIC as total_commission
  FROM dsrs d
  JOIN profiles p ON d.user_id = p.id
  LEFT JOIN sales s ON s.dsr_id = d.id 
    AND s.commission_status = 'eligible'
    AND DATE_TRUNC('month', s.created_at::DATE) = DATE_TRUNC('month', target_month)
  GROUP BY d.id, p.full_name, d.tier;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify notifications table
SELECT 'Notifications table created' as status, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'notifications'
) as exists;

-- Verify commission columns
SELECT 'Commission columns added' as status, EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'sales'
  AND column_name = 'commission_status'
) as exists;

-- Verify commission_payouts table
SELECT 'Commission payouts table created' as status, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'commission_payouts'
) as exists;

-- Verify DSR fields
SELECT 'DSR fields added' as status, EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'dsrs'
  AND column_name = 'tier'
) as exists;

-- Success message
SELECT '✅ Migration completed successfully!' as message;
SELECT 'Next steps:' as instruction;
SELECT '1. Update TypeScript types by running: npx supabase gen types typescript' as step_1;
SELECT '2. Test commission calculations on sales' as step_2;
SELECT '3. Set up cron jobs for check_payment_delays() and check_stock_levels()' as step_3;
