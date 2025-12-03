-- Add target columns to management tables

-- Add targets to managers (RSM/TSM)
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS monthly_target DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS target_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.managers ADD COLUMN IF NOT EXISTS target_updated_by UUID REFERENCES auth.users(id);

-- Add targets to team_leaders
ALTER TABLE public.team_leaders ADD COLUMN IF NOT EXISTS monthly_target DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.team_leaders ADD COLUMN IF NOT EXISTS target_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.team_leaders ADD COLUMN IF NOT EXISTS target_updated_by UUID REFERENCES auth.users(id);

-- Add targets to distribution_executives
ALTER TABLE public.distribution_executives ADD COLUMN IF NOT EXISTS monthly_target DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.distribution_executives ADD COLUMN IF NOT EXISTS target_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.distribution_executives ADD COLUMN IF NOT EXISTS target_updated_by UUID REFERENCES auth.users(id);

-- Create an index for faster target queries
CREATE INDEX IF NOT EXISTS idx_managers_target ON public.managers(monthly_target);
CREATE INDEX IF NOT EXISTS idx_team_leaders_target ON public.team_leaders(monthly_target);
CREATE INDEX IF NOT EXISTS idx_distribution_executives_target ON public.distribution_executives(monthly_target);
