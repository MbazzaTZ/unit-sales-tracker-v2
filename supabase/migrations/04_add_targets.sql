-- Add target columns to management tables
-- This migration is safe to run multiple times (uses IF NOT EXISTS)

-- Check if column exists before adding to avoid errors
DO $$ 
BEGIN
  -- Add targets to managers (RSM/TSM)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'managers' 
                 AND column_name = 'monthly_target') THEN
    ALTER TABLE public.managers ADD COLUMN monthly_target DECIMAL(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'managers' 
                 AND column_name = 'target_updated_at') THEN
    ALTER TABLE public.managers ADD COLUMN target_updated_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'managers' 
                 AND column_name = 'target_updated_by') THEN
    ALTER TABLE public.managers ADD COLUMN target_updated_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add targets to distribution_executives
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'distribution_executives' 
                 AND column_name = 'monthly_target') THEN
    ALTER TABLE public.distribution_executives ADD COLUMN monthly_target DECIMAL(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'distribution_executives' 
                 AND column_name = 'target_updated_at') THEN
    ALTER TABLE public.distribution_executives ADD COLUMN target_updated_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'distribution_executives' 
                 AND column_name = 'target_updated_by') THEN
    ALTER TABLE public.distribution_executives ADD COLUMN target_updated_by UUID REFERENCES auth.users(id);
  END IF;

  -- Add zone_id to distribution_executives if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'distribution_executives' 
                 AND column_name = 'zone_id') THEN
    ALTER TABLE public.distribution_executives ADD COLUMN zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;
  END IF;

  -- Add territory_id to distribution_executives if it doesn't exist (change TEXT to UUID)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'distribution_executives' 
             AND column_name = 'territory_id'
             AND data_type = 'text') THEN
    ALTER TABLE public.distribution_executives RENAME COLUMN territory_id TO territory_id_old;
    ALTER TABLE public.distribution_executives ADD COLUMN territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'distribution_executives' 
                    AND column_name = 'territory_id') THEN
    ALTER TABLE public.distribution_executives ADD COLUMN territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create an index for faster target queries
CREATE INDEX IF NOT EXISTS idx_managers_target ON public.managers(monthly_target);
CREATE INDEX IF NOT EXISTS idx_team_leaders_target ON public.team_leaders(monthly_target);
CREATE INDEX IF NOT EXISTS idx_distribution_executives_target ON public.distribution_executives(monthly_target);
