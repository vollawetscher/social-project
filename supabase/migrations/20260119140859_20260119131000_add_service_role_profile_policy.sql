/*
  # Add Service Role Policy for Profile Creation

  ## Problem
  The trigger function `handle_new_user()` runs with SECURITY DEFINER, but the
  INSERT policy on profiles still checks auth.uid() = id. When auth.admin.createUser()
  is called, auth.uid() is NULL, causing the profile insert to fail.

  ## Solution
  Add a service_role policy that allows profile inserts without auth.uid() checks.
  This allows the trigger to successfully create profiles when new users are created.

  ## Security
  - The service_role policy only applies to the service role (used by triggers)
  - Regular authenticated user policies remain unchanged
  - Users can still only access their own profiles
*/

-- Add service role policy to allow trigger to create profiles
CREATE POLICY "Service role can insert profiles"
  ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);
