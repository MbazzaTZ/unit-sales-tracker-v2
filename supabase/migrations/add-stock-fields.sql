-- ============================================
-- Add Additional Stock Fields
-- Smart card number, serial number, territory fields
-- ============================================

-- Add smartcard_number column
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS smartcard_number TEXT;

-- Add serial_number column
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Add territory column
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS territory TEXT;

-- Add sub_territory column
ALTER TABLE public.stock 
ADD COLUMN IF NOT EXISTS sub_territory TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_smartcard ON public.stock(smartcard_number);
CREATE INDEX IF NOT EXISTS idx_stock_serial ON public.stock(serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_territory ON public.stock(territory);

-- Add comments
COMMENT ON COLUMN public.stock.smartcard_number IS 'Smart card number for the stock item';
COMMENT ON COLUMN public.stock.serial_number IS 'Serial number for the stock item';
COMMENT ON COLUMN public.stock.territory IS 'Territory assignment for stock';
COMMENT ON COLUMN public.stock.sub_territory IS 'Sub-territory assignment for stock';

-- Verify columns added
SELECT 'Stock fields added successfully' as status;
