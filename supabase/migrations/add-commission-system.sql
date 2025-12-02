-- ============================================
-- Add Commission System Columns
-- ============================================

-- Add DSR tier column to dsrs table
ALTER TABLE public.dsrs
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'KURUTA';

-- Add comment to tier column
COMMENT ON COLUMN public.dsrs.tier IS 'DSR performance tier: KURUTA, CHUMA, SHABA, FEDHA, DHAHABU, TANZANITE';

-- Add commission tracking columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending-approval',
ADD COLUMN IF NOT EXISTS commission_reason TEXT,
ADD COLUMN IF NOT EXISTS upfront_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activation_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_commission NUMERIC(10, 2) DEFAULT 0;

-- Add check constraint for commission status
ALTER TABLE public.sales
ADD CONSTRAINT check_commission_status 
CHECK (commission_status IN ('eligible', 'pending-approval', 'not-eligible'));

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

-- Enable RLS
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_payouts
CREATE POLICY "DSRs can view their own commission payouts"
  ON public.commission_payouts
  FOR SELECT
  USING (
    dsr_id IN (
      SELECT id FROM dsrs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Managers can view all commission payouts"
  ON public.commission_payouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert commission payouts"
  ON public.commission_payouts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update commission payouts"
  ON public.commission_payouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to calculate and update commission for a sale
CREATE OR REPLACE FUNCTION calculate_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  sale_revenue NUMERIC(10, 2);
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
  IF NEW.sale_type != 'DVS' AND NEW.payment_status = 'unpaid' THEN
    -- FS/DO unpaid = not eligible
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

-- Add index to sales for commission queries
CREATE INDEX IF NOT EXISTS idx_sales_commission_status ON public.sales(commission_status);
CREATE INDEX IF NOT EXISTS idx_sales_dsr_created ON public.sales(dsr_id, created_at);
