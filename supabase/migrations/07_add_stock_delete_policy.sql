-- Add DELETE policy for stock table
-- This allows admins to delete stock items

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can delete stock" ON public.stock;

-- Create DELETE policy for admins
CREATE POLICY "Admins can delete stock" 
ON public.stock 
FOR DELETE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
