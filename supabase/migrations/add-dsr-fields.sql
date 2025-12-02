-- ============================================
-- Add Missing Fields to DSRs Table
-- ============================================

-- Add dsr_number column
ALTER TABLE public.dsrs 
ADD COLUMN IF NOT EXISTS dsr_number TEXT;

-- Add territory column
ALTER TABLE public.dsrs 
ADD COLUMN IF NOT EXISTS territory TEXT;

-- Add index for dsr_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_dsrs_dsr_number ON public.dsrs(dsr_number);

-- Update RLS policies are already in place, no changes needed
