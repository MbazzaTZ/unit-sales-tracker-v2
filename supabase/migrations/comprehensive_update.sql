-- ============================================
-- COMPREHENSIVE DATABASE UPDATE
-- DSTV Tanzania Sales Tracker
-- Date: December 3, 2025
-- ============================================

-- ============================================
-- PART 1: UPDATE ENUMS
-- ============================================

-- Add DVS to sale_type enum if not exists
DO $$ 
BEGIN
  BEGIN
    ALTER TYPE public.sale_type ADD VALUE IF NOT EXISTS 'DVS';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============================================
-- PART 2: UPDATE TABLES - ADD DSTV TANZANIA PACKAGES
-- ============================================

-- Create DSTV packages table
CREATE TABLE IF NOT EXISTS public.dstv_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  package_name TEXT NOT NULL,
  monthly_price NUMERIC(10, 2) NOT NULL,
  description TEXT,
  channels_count INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert DSTV Tanzania Packages (2025 Prices)
INSERT INTO public.dstv_packages (package_code, package_name, monthly_price, description, channels_count) VALUES
  ('ACCESS', 'DStv Access', 6000, 'Basic entertainment package', 45),
  ('FAMILY', 'DStv Family', 25000, 'Family entertainment package', 110),
  ('COMPACT', 'DStv Compact', 42000, 'Popular entertainment package', 150),
  ('COMPACT_PLUS', 'DStv Compact Plus', 75000, 'Premium entertainment package', 180),
  ('PREMIUM', 'DStv Premium', 105000, 'All channels premium package', 220)
ON CONFLICT (package_code) DO UPDATE SET
  monthly_price = EXCLUDED.monthly_price,
  updated_at = NOW();

-- ============================================
-- PART 3: UPDATE SALES TABLE
-- ============================================

-- Add commission and notification fields to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS dstv_package_id UUID REFERENCES public.dstv_packages(id),
ADD COLUMN IF NOT EXISTS upfront_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activation_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- PART 4: CREATE COMMISSION RATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL, -- 'FS', 'DO', 'DVS'
  upfront_amount NUMERIC(10, 2) DEFAULT 0,
  activation_amount NUMERIC(10, 2) DEFAULT 0,
  package_commission_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage of package price
  description TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert DSTV Tanzania Commission Rates (2025)
INSERT INTO public.commission_rates (product_type, upfront_amount, activation_amount, package_commission_rate, description) VALUES
  ('FS', 5000, 3000, 10.00, 'Full Set - Upfront: 5,000 TZS, Activation: 3,000 TZS, Package: 10%'),
  ('DO', 2000, 1500, 8.00, 'Decoder Only - Upfront: 2,000 TZS, Activation: 1,500 TZS, Package: 8%'),
  ('DVS', 1500, 1000, 5.00, 'Digital Virtual Stock - Upfront: 1,500 TZS, Activation: 1,000 TZS, Package: 5%')
ON CONFLICT DO NOTHING;

-- ============================================
-- PART 5: CREATE BONUS TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.dsr_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dsr_id UUID REFERENCES public.dsrs(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sales_count INTEGER DEFAULT 0,
  bonus_amount NUMERIC(10, 2) DEFAULT 0,
  bonus_triggered_at TIMESTAMP WITH TIME ZONE,
  bonus_paid BOOLEAN DEFAULT FALSE,
  bonus_paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 6: CREATE NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'sale_complete', 'bonus_earned', 'commission_approved', etc.
  data JSONB, -- Additional data like earnings breakdown
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 7: CREATE EARNINGS VIEW FOR DSR
-- ============================================

CREATE OR REPLACE VIEW public.dsr_earnings_view AS
SELECT 
  d.id as dsr_id,
  d.user_id,
  p.full_name as dsr_name,
  COUNT(s.id) as total_sales,
  SUM(CASE WHEN s.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_sales,
  SUM(s.total_commission) as total_earnings,
  SUM(CASE WHEN EXTRACT(MONTH FROM s.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
           AND EXTRACT(YEAR FROM s.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      THEN s.total_commission ELSE 0 END) as mtd_earnings,
  SUM(CASE WHEN EXTRACT(MONTH FROM s.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
           AND EXTRACT(YEAR FROM s.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      THEN 1 ELSE 0 END) as mtd_sales
FROM public.dsrs d
LEFT JOIN public.profiles p ON d.user_id = p.id
LEFT JOIN public.sales s ON d.id = s.dsr_id
GROUP BY d.id, d.user_id, p.full_name;

-- ============================================
-- PART 8: CREATE FUNCTION TO CALCULATE COMMISSION
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_sale_commission(
  p_sale_type TEXT,
  p_package_id UUID,
  p_payment_status TEXT,
  p_admin_approved BOOLEAN
)
RETURNS TABLE (
  upfront NUMERIC,
  activation NUMERIC,
  package_comm NUMERIC,
  total NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_rate RECORD;
  v_package_price NUMERIC;
  v_upfront NUMERIC := 0;
  v_activation NUMERIC := 0;
  v_package NUMERIC := 0;
  v_total NUMERIC := 0;
  v_status TEXT := 'pending';
BEGIN
  -- Get commission rate for product type
  SELECT * INTO v_rate
  FROM public.commission_rates
  WHERE product_type = p_sale_type AND is_active = TRUE
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 'no-rate'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate upfront commission (always payable on sale creation)
  v_upfront := v_rate.upfront_amount;
  
  -- Calculate activation and package commission based on payment and approval
  IF p_payment_status = 'paid' AND (p_admin_approved IS NULL OR p_admin_approved = TRUE) THEN
    v_activation := v_rate.activation_amount;
    v_status := 'approved';
    
    -- Calculate package commission if package selected
    IF p_package_id IS NOT NULL THEN
      SELECT monthly_price INTO v_package_price
      FROM public.dstv_packages
      WHERE id = p_package_id;
      
      IF v_package_price IS NOT NULL THEN
        v_package := (v_package_price * v_rate.package_commission_rate) / 100;
      END IF;
    END IF;
  ELSIF p_admin_approved = FALSE THEN
    v_status := 'rejected';
  ELSIF p_payment_status = 'unpaid' THEN
    v_status := 'pending-payment';
  END IF;
  
  v_total := v_upfront + v_activation + v_package;
  
  RETURN QUERY SELECT v_upfront, v_activation, v_package, v_total, v_status;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 9: CREATE TRIGGER TO AUTO-CALCULATE COMMISSION
-- ============================================

CREATE OR REPLACE FUNCTION public.update_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission RECORD;
BEGIN
  -- Calculate commission
  SELECT * INTO v_commission
  FROM public.calculate_sale_commission(
    NEW.sale_type,
    NEW.dstv_package_id,
    NEW.payment_status,
    NEW.admin_approved
  );
  
  -- Update commission fields
  NEW.upfront_commission := v_commission.upfront;
  NEW.activation_commission := v_commission.activation;
  NEW.package_commission := v_commission.package_comm;
  NEW.total_commission := v_commission.total;
  NEW.commission_status := v_commission.status;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_commission ON public.sales;
CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF payment_status, admin_approved, dstv_package_id
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sale_commission();

-- ============================================
-- PART 10: CREATE FUNCTION TO SEND SALE NOTIFICATION
-- ============================================

CREATE OR REPLACE FUNCTION public.send_sale_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_dsr_user_id UUID;
  v_mtd_earnings NUMERIC;
  v_mtd_sales INTEGER;
BEGIN
  -- Get DSR user_id
  SELECT user_id INTO v_dsr_user_id
  FROM public.dsrs
  WHERE id = NEW.dsr_id;
  
  IF v_dsr_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get MTD earnings
  SELECT mtd_earnings, mtd_sales INTO v_mtd_earnings, v_mtd_sales
  FROM public.dsr_earnings_view
  WHERE dsr_id = NEW.dsr_id;
  
  -- Create notification
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    v_dsr_user_id,
    '🎉 Sale Recorded Successfully!',
    format('You earned TZS %s from this sale. MTD Earnings: TZS %s from %s sales',
           NEW.total_commission,
           COALESCE(v_mtd_earnings, 0),
           COALESCE(v_mtd_sales, 0)),
    'sale_complete',
    jsonb_build_object(
      'sale_id', NEW.id,
      'earnings', NEW.total_commission,
      'mtd_earnings', v_mtd_earnings,
      'mtd_sales', v_mtd_sales,
      'breakdown', jsonb_build_object(
        'upfront', NEW.upfront_commission,
        'activation', NEW.activation_commission,
        'package', NEW.package_commission
      )
    )
  );
  
  -- Mark notification as sent
  NEW.notification_sent := TRUE;
  NEW.notification_sent_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sale_notification ON public.sales;
CREATE TRIGGER trigger_sale_notification
  AFTER INSERT
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.send_sale_notification();

-- ============================================
-- PART 11: CREATE FUNCTION TO CHECK BONUS
-- ============================================

CREATE OR REPLACE FUNCTION public.check_dsr_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_mtd_sales INTEGER;
  v_bonus_amount NUMERIC := 10000; -- TZS 10,000 bonus for every 2 sales
  v_dsr_user_id UUID;
BEGIN
  -- Get DSR user_id
  SELECT user_id INTO v_dsr_user_id
  FROM public.dsrs
  WHERE id = NEW.dsr_id;
  
  -- Count MTD sales
  SELECT COUNT(*) INTO v_mtd_sales
  FROM public.sales
  WHERE dsr_id = NEW.dsr_id
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND payment_status = 'paid';
  
  -- Check if bonus should be awarded (every 2 sales)
  IF v_mtd_sales % 2 = 0 AND v_mtd_sales > 0 THEN
    -- Record bonus
    INSERT INTO public.dsr_bonuses (
      dsr_id,
      period_start,
      period_end,
      sales_count,
      bonus_amount,
      bonus_triggered_at
    ) VALUES (
      NEW.dsr_id,
      DATE_TRUNC('month', CURRENT_DATE),
      DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
      v_mtd_sales,
      v_bonus_amount,
      NOW()
    );
    
    -- Send bonus notification
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      v_dsr_user_id,
      '🎁 Bonus Unlocked!',
      format('Congratulations! You achieved %s sales this month and earned a TZS %s bonus!',
             v_mtd_sales, v_bonus_amount),
      'bonus_earned',
      jsonb_build_object(
        'sales_count', v_mtd_sales,
        'bonus_amount', v_bonus_amount
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_bonus ON public.sales;
CREATE TRIGGER trigger_check_bonus
  AFTER INSERT OR UPDATE OF payment_status
  ON public.sales
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid')
  EXECUTE FUNCTION public.check_dsr_bonus();

-- ============================================
-- PART 12: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_dsr_created ON public.sales(dsr_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_commission_status ON public.sales(commission_status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_dstv_packages_active ON public.dstv_packages(is_active) WHERE is_active = TRUE;

-- ============================================
-- PART 13: UPDATE RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.dstv_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsr_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for dstv_packages (public read)
CREATE POLICY "Anyone can view active packages" ON public.dstv_packages
  FOR SELECT USING (is_active = TRUE);

-- Policies for notifications (user can view their own)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for dsr_bonuses (user can view their own)
CREATE POLICY "DSRs can view own bonuses" ON public.dsr_bonuses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dsrs
      WHERE dsrs.id = dsr_bonuses.dsr_id
        AND dsrs.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT ON public.dstv_packages TO authenticated;
GRANT SELECT ON public.commission_rates TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.dsr_bonuses TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
