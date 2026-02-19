-- Add contact_name to calls so saved-contact names survive into recent calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_name TEXT;
