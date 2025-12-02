-- ============================================
-- ADD MANAGERS TABLE
-- ============================================

-- Create managers table
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  manager_type TEXT NOT NULL CHECK (manager_type IN ('RSM', 'TSM')),
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  territory TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT manager_assignment_check CHECK (
    (manager_type = 'RSM' AND region_id IS NOT NULL AND territory IS NULL) OR
    (manager_type = 'TSM' AND territory IS NOT NULL AND region_id IS NULL)
  )
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_managers_user_id ON public.managers(user_id);
CREATE INDEX IF NOT EXISTS idx_managers_region_id ON public.managers(region_id);
CREATE INDEX IF NOT EXISTS idx_managers_type ON public.managers(manager_type);

-- Add comments
COMMENT ON TABLE public.managers IS 'Managers with access to dashboard, stock overview, and sales team performance';
COMMENT ON COLUMN public.managers.manager_type IS 'RSM (Regional Sales Manager) or TSM (Territory Sales Manager)';
COMMENT ON COLUMN public.managers.region_id IS 'For RSM: assigned region';
COMMENT ON COLUMN public.managers.territory IS 'For TSM: assigned territory';

-- Enable RLS
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for managers
DROP POLICY IF EXISTS "Managers can view their own record" ON public.managers;
CREATE POLICY "Managers can view their own record"
  ON public.managers
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all managers" ON public.managers;
CREATE POLICY "Admins can view all managers"
  ON public.managers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert managers" ON public.managers;
CREATE POLICY "Admins can insert managers"
  ON public.managers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update managers" ON public.managers;
CREATE POLICY "Admins can update managers"
  ON public.managers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete managers" ON public.managers;
CREATE POLICY "Admins can delete managers"
  ON public.managers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Verification
SELECT 'Managers table created' as status, EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'managers'
) as exists;

SELECT '✅ Managers table migration completed successfully!' as message;
