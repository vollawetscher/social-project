/*
  # Fix Recursive Profile Policies

  1. Changes
    - Drop the recursive admin policy that causes infinite recursion
    - Add INSERT policy for profile creation (needed by trigger)
    - Add UPDATE policy for profile updates
    - Simplify admin role check to avoid recursion

  2. Security
    - Users can read their own profile
    - Users can insert their own profile (needed during signup)
    - Users can update their own profile
    - Admin functionality can be added later without recursive queries

  3. Notes
    - The handle_new_user trigger uses SECURITY DEFINER to bypass RLS
    - Policies should never query the same table they're protecting
*/

-- Drop the recursive admin policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Keep the simple user read policy (already exists)
-- Policy "Users can read own profile" for SELECT

-- Add INSERT policy for user profile creation (needed by trigger and signup)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add UPDATE policy for user profile updates
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- For admin functionality, we'll use a different approach:
-- Store admin status in auth.users metadata and check jwt claims instead
-- This avoids recursive queries entirely