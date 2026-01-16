/*
  # Make user_id nullable for MVP testing

  1. Changes
    - Make sessions.user_id nullable to allow anonymous sessions
    - Keep foreign key constraint but allow NULL values
    - This enables MVP testing without authentication

  2. Security
    - Foreign key still validates when user_id is provided
    - For production, user_id should be required again
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' 
    AND column_name = 'user_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sessions ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;
