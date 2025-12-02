-- ============================================
-- Fix Sale Type Data Migration
-- Convert any non-enum text values to proper enum values
-- ============================================

-- First, check if there are any sales with invalid sale_type values
-- SELECT sale_type, COUNT(*) FROM sales GROUP BY sale_type;

-- If there are text values like 'Full Set' or 'Decoder Only', update them
UPDATE sales 
SET sale_type = 'FS'::sale_type
WHERE sale_type::text = 'Full Set' OR sale_type::text = 'FS';

UPDATE sales 
SET sale_type = 'DO'::sale_type  
WHERE sale_type::text = 'Decoder Only' OR sale_type::text = 'DO' OR sale_type::text = 'DVS';

-- Verify the fix
SELECT 'Sale type data cleaned' as status;
SELECT sale_type, COUNT(*) as count FROM sales GROUP BY sale_type;
