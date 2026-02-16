-- User-level word corrections for transcript display and future Speechmatics custom vocabulary
-- Stores original (misheard) -> corrected mapping per user with use_count for popularity
-- Top corrections will later be sent as additional_vocab to Speechmatics to improve future transcriptions

CREATE TABLE IF NOT EXISTS user_word_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original text NOT NULL,
  corrected text NOT NULL,
  use_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_word_corrections_user_original_unique UNIQUE (user_id, original)
);

CREATE INDEX IF NOT EXISTS idx_user_word_corrections_user_id ON user_word_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_word_corrections_use_count ON user_word_corrections(user_id, use_count DESC);

COMMENT ON TABLE user_word_corrections IS 'Per-user word corrections (original->corrected). use_count tracks usage; top entries will be sent to Speechmatics as additional_vocab for future transcriptions.';
COMMENT ON COLUMN user_word_corrections.original IS 'Misheard word from ASR (e.g. SPQR, Maître Spet)';
COMMENT ON COLUMN user_word_corrections.corrected IS 'Correct replacement (e.g. speaker, Mattress Bed)';
COMMENT ON COLUMN user_word_corrections.use_count IS 'Incremented when user applies this correction in a session; used to rank for Speechmatics dictionary';

ALTER TABLE user_word_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own word corrections"
  ON user_word_corrections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
