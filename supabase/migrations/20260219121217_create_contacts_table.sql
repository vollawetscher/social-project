-- Contacts table: per-user phone/email contact book for the calls feature
CREATE TABLE IF NOT EXISTS contacts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  phone_number text,
  email       text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own contacts
CREATE POLICY "Users manage own contacts"
  ON contacts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user listing
CREATE INDEX contacts_user_id_idx ON contacts (user_id, created_at DESC);
