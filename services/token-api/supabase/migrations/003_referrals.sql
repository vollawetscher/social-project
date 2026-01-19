-- ===========================================
-- Referral System Tables
-- Codes, Attribution, and Tracking
-- ===========================================

-- Referral Codes
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  owner_account_id TEXT NOT NULL,  -- Account that created the code
  campaign TEXT,  -- Optional campaign identifier
  reward_tokens INTEGER DEFAULT 0,  -- Default reward amount
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_account_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- Referral Attributions
CREATE TABLE IF NOT EXISTS referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID REFERENCES referral_codes(id) ON DELETE CASCADE,
  referred_account_id TEXT UNIQUE NOT NULL,  -- Each account can only be referred once
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ,  -- When first purchase happened
  reward_paid_at TIMESTAMPTZ,  -- When reward was credited
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_code ON referral_attributions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_referred ON referral_attributions(referred_account_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_status ON referral_attributions(status);

-- RLS Policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to referral_codes"
  ON referral_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to referral_attributions"
  ON referral_attributions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
