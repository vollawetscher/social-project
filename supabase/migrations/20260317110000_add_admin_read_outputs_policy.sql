-- Allow admins to read all outputs (for admin session view with cost tracking).
CREATE POLICY "Admins can view all outputs"
  ON public.outputs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
