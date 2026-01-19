-- ===========================================
-- Ledger Entries Table (Append-Only)
-- Immutable record of all token transactions
-- ===========================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES token_wallets(id) ON DELETE CASCADE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'reserve', 'release', 'refund', 'adjustment')),
  amount INTEGER NOT NULL,  -- Positive for credit/reserve, negative for debit/release/refund
  balance_after INTEGER NOT NULL,  -- Balance after this transaction
  idempotency_key TEXT UNIQUE,  -- For idempotent operations
  source TEXT NOT NULL CHECK (source IN ('stripe', 'referral', 'manual', 'app', 'system')),
  source_reference TEXT,  -- e.g., Stripe Payment Intent ID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_source ON ledger_entries(source);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_idempotency ON ledger_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- RLS Policies
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to ledger_entries"
  ON ledger_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
