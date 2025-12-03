-- Add serial_number and smartcard_number columns to stock table
-- These fields will store the physical serial and smartcard numbers for each stock item
-- Also add auto-generation for stock_id based on type

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

-- Create sequence counters for each stock type
CREATE SEQUENCE IF NOT EXISTS stock_fs_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS stock_do_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS stock_dvs_seq START WITH 1;

-- Function to generate stock_id based on type
CREATE OR REPLACE FUNCTION generate_stock_id()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num TEXT;
  next_val INTEGER;
BEGIN
  -- Only generate if stock_id is null or empty
  IF NEW.stock_id IS NULL OR NEW.stock_id = '' THEN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    -- Get next sequence number based on type
    CASE NEW.type
      WHEN 'FS' THEN
        next_val := nextval('stock_fs_seq');
      WHEN 'DO' THEN
        next_val := nextval('stock_do_seq');
      WHEN 'DVS' THEN
        next_val := nextval('stock_dvs_seq');
      ELSE
        next_val := nextval('stock_fs_seq'); -- Default to FS
    END CASE;
    
    -- Format sequence number with leading zeros (6 digits)
    seq_num := LPAD(next_val::TEXT, 6, '0');
    
    -- Generate stock_id: TYPE + YEAR + - + SEQUENCE
    NEW.stock_id := NEW.type || year_part || '-' || seq_num;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate stock_id
DROP TRIGGER IF EXISTS trigger_generate_stock_id ON public.stock;
CREATE TRIGGER trigger_generate_stock_id
  BEFORE INSERT ON public.stock
  FOR EACH ROW
  EXECUTE FUNCTION generate_stock_id();
