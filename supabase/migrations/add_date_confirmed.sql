-- ============================================
-- Add date_confirmed column to stock table
-- Date: December 3, 2025
-- ============================================

-- Add date_confirmed column to track when DSR confirms receipt of stock
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS date_confirmed TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_date_confirmed ON public.stock(date_confirmed);

-- Add comment
COMMENT ON COLUMN public.stock.date_confirmed IS 'Timestamp when DSR confirmed receipt of assigned stock';

-- Verify column added
SELECT 'date_confirmed column added successfully' as status;
