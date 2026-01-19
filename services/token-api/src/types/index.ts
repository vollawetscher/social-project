// ===========================================
// Token API - Type Definitions
// ===========================================

// Wallet Types
export interface TokenWallet {
  id: string;
  account_id: string;
  balance: number;
  reserved: number;
  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  account_id: string;
  balance: number;
  reserved: number;
  available: number; // balance - reserved
}

// Ledger Types
export type LedgerEntryType = 'credit' | 'debit' | 'reserve' | 'release' | 'refund' | 'adjustment';
export type LedgerSource = 'stripe' | 'referral' | 'manual' | 'app' | 'system';

export interface LedgerEntry {
  id: string;
  wallet_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  balance_after: number;
  idempotency_key: string | null;
  source: LedgerSource;
  source_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateLedgerEntry {
  wallet_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  source: LedgerSource;
  source_reference?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}

// Referral Types
export interface ReferralCode {
  id: string;
  code: string;
  owner_account_id: string;
  campaign: string | null;
  reward_tokens: number;
  is_active: boolean;
  created_at: string;
}

export type ReferralStatus = 'pending' | 'converted' | 'rewarded' | 'rejected';

export interface ReferralAttribution {
  id: string;
  referral_code_id: string;
  referred_account_id: string;
  first_seen_at: string;
  converted_at: string | null;
  reward_paid_at: string | null;
  status: ReferralStatus;
}

// API Request/Response Types
export interface ConsumeTokensRequest {
  account_id: string;
  amount: number;
  idempotency_key: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ReserveTokensRequest {
  account_id: string;
  amount: number;
  idempotency_key: string;
  job_id?: string;
}

export interface ReleaseTokensRequest {
  account_id: string;
  amount: number;
  reservation_id: string;
}

export interface CreditTokensRequest {
  account_id: string;
  amount: number;
  source: LedgerSource;
  source_reference?: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateReferralRequest {
  owner_account_id: string;
  campaign?: string;
  reward_tokens?: number;
}

export interface AttributeReferralRequest {
  referral_code: string;
  referred_account_id: string;
}

export interface ConvertReferralRequest {
  referred_account_id: string;
  reward_tokens: number; // Amount set by host app
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Idempotency
export interface IdempotencyRecord {
  key: string;
  response: ApiResponse;
  created_at: string;
  expires_at: string;
}
