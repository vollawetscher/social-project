/*
  # Add Automatic Profile Creation

  1. Changes
    - Creates a trigger function to automatically create a profile when a user signs up
    - Creates a trigger on auth.users that calls this function
    - Backfills any existing users without profiles

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates profiles, doesn't modify existing ones
*/

-- Function to automatically create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to call the function when a new user is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill existing users who don't have profiles
INSERT INTO public.profiles (id, email, role)
SELECT 
  au.id,
  au.email,
  'user'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
