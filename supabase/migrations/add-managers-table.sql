-- ============================================
-- ADD MANAGERS TABLE
-- ============================================

-- Create managers table
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_managers_user_id ON public.managers(user_id);

-- Add comment
COMMENT ON TABLE public.managers IS 'Managers with access to dashboard, stock overview, and sales team performance';

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
