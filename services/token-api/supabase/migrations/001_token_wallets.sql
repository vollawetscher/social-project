-- ===========================================
-- Token Wallets Table
-- Stores token balance per account
-- ===========================================

CREATE TABLE IF NOT EXISTS token_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT UNIQUE NOT NULL,  -- External User ID from Host App
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by account_id
CREATE INDEX IF NOT EXISTS idx_token_wallets_account_id ON token_wallets(account_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_token_wallets_updated_at
  BEFORE UPDATE ON token_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (Service role has full access)
ALTER TABLE token_wallets ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to token_wallets"
  ON token_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
