-- ============================================
-- Add Stock Type to Sales Table
-- ============================================

-- Add stock_type column to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS stock_type TEXT;

-- Add check constraint for valid stock types
ALTER TABLE public.sales 
ADD CONSTRAINT check_stock_type 
CHECK (stock_type IN ('FS', 'DO', 'DVS') OR stock_type IS NULL);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_stock_type ON public.sales(stock_type);

-- Add comment
COMMENT ON COLUMN public.sales.stock_type IS 'Type of stock sold: FS (Full Set - 65,000 TZS), DO (Decoder Only - 25,000 TZS), DVS (Digital Virtual Stock - 27,500 TZS)';
