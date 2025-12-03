-- Add serial_number and smartcard_number columns to stock table
-- These fields will store the physical serial and smartcard numbers for each stock item

DO $$ 
BEGIN
  -- Add serial_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stock' 
    AND column_name = 'serial_number'
  ) THEN
    ALTER TABLE public.stock 
    ADD COLUMN serial_number TEXT;
    
    COMMENT ON COLUMN public.stock.serial_number IS 'Physical serial number on the device';
  END IF;

  -- Add smartcard_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stock' 
    AND column_name = 'smartcard_number'
  ) THEN
    ALTER TABLE public.stock 
    ADD COLUMN smartcard_number TEXT;
    
    COMMENT ON COLUMN public.stock.smartcard_number IS 'Smartcard number associated with the stock';
  END IF;
END $$;
