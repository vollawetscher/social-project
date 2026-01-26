-- Add UPDATE policy for reports table
-- This allows users to update reports for their own sessions
-- Needed for report regeneration functionality

CREATE POLICY "Users can update reports for own sessions"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = reports.session_id AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = reports.session_id AND sessions.user_id = auth.uid()
    )
  );

-- Add admin update policy as well
CREATE POLICY "Admins can update all reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
