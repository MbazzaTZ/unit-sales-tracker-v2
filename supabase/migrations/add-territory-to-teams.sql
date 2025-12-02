-- ============================================
-- Add Territory Column to Teams Table
-- ============================================
-- Run this in Supabase SQL Editor

-- Add territory column to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS territory TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'teams'
ORDER BY ordinal_position;
