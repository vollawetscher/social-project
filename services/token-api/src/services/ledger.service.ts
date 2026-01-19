// ===========================================
// Token Ledger Service
// Handles all token balance operations with atomic guarantees
// ===========================================
import { getSupabase } from '../db/supabase.js';
import type { 
  TokenWallet, 
  WalletBalance, 
  LedgerEntry, 
  LedgerEntryType,
  LedgerSource,
  ApiResponse 
} from '../types/index.js';

export class LedgerService {
  
  /**
   * Get or create wallet for an account
   */
  async getOrCreateWallet(accountId: string): Promise<TokenWallet> {
    const supabase = getSupabase();
    
    // Try to get existing wallet
    const { data: existing } = await supabase
      .from('token_wallets')
      .select('*')
      .eq('account_id', accountId)
      .single();
    
    if (existing) {
      return existing as TokenWallet;
    }
    
    // Create new wallet
    const { data: newWallet, error } = await supabase
      .from('token_wallets')
      .insert({ account_id: accountId, balance: 0, reserved: 0 })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
    
    return newWallet as TokenWallet;
  }
  
  /**
   * Get balance for an account
   */
  async getBalance(accountId: string): Promise<WalletBalance> {
    const wallet = await this.getOrCreateWallet(accountId);
    
    return {
      account_id: wallet.account_id,
      balance: wallet.balance,
      reserved: wallet.reserved,
      available: wallet.balance - wallet.reserved,
    };
  }
  
  /**
   * Credit tokens to an account (atomic operation)
   */
  async credit(
    accountId: string,
    amount: number,
    source: LedgerSource,
    options: {
      sourceReference?: string;
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<ApiResponse<{ balance: WalletBalance; entry: LedgerEntry }>> {
    if (amount <= 0) {
      return { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
    }
    
    const supabase = getSupabase();
    
    // Check idempotency
    if (options.idempotencyKey) {
      const cached = await this.checkIdempotency<{ balance: WalletBalance; entry: LedgerEntry }>(options.idempotencyKey);
      if (cached) return cached;
    }
    
    const wallet = await this.getOrCreateWallet(accountId);
    const newBalance = wallet.balance + amount;
    
    // Update wallet balance
    const { error: updateError } = await supabase
      .from('token_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id)
      .eq('balance', wallet.balance); // Optimistic lock
    
    if (updateError) {
      return { success: false, error: { code: 'UPDATE_FAILED', message: 'Concurrent modification detected' } };
    }
    
    // Create ledger entry
    const { data: entry, error: entryError } = await supabase
      .from('ledger_entries')
      .insert({
        wallet_id: wallet.id,
        entry_type: 'credit' as LedgerEntryType,
        amount,
        balance_after: newBalance,
        source,
        source_reference: options.sourceReference || null,
        idempotency_key: options.idempotencyKey || null,
        metadata: options.metadata || {},
      })
      .select()
      .single();
    
    if (entryError) {
      console.error('Failed to create ledger entry:', entryError);
      return { success: false, error: { code: 'LEDGER_ERROR', message: 'Failed to record transaction' } };
    }
    
    const response: ApiResponse<{ balance: WalletBalance; entry: LedgerEntry }> = {
      success: true,
      data: {
        balance: {
          account_id: accountId,
          balance: newBalance,
          reserved: wallet.reserved,
          available: newBalance - wallet.reserved,
        },
        entry: entry as LedgerEntry,
      },
    };
    
    // Store idempotency response
    if (options.idempotencyKey) {
      await this.storeIdempotency(options.idempotencyKey, response);
    }
    
    return response;
  }
  
  /**
   * Consume (debit) tokens from an account
   */
  async consume(
    accountId: string,
    amount: number,
    options: {
      idempotencyKey: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<{ balance: WalletBalance; entry: LedgerEntry }>> {
    if (amount <= 0) {
      return { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
    }
    
    const supabase = getSupabase();
    
    // Check idempotency
    const cached = await this.checkIdempotency<{ balance: WalletBalance; entry: LedgerEntry }>(options.idempotencyKey);
    if (cached) return cached;
    
    const wallet = await this.getOrCreateWallet(accountId);
    const available = wallet.balance - wallet.reserved;
    
    if (available < amount) {
      return { 
        success: false, 
        error: { 
          code: 'INSUFFICIENT_BALANCE', 
          message: `Insufficient balance. Available: ${available}, Required: ${amount}` 
        } 
      };
    }
    
    const newBalance = wallet.balance - amount;
    
    // Update wallet balance
    const { error: updateError } = await supabase
      .from('token_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id)
      .eq('balance', wallet.balance); // Optimistic lock
    
    if (updateError) {
      return { success: false, error: { code: 'UPDATE_FAILED', message: 'Concurrent modification detected' } };
    }
    
    // Create ledger entry
    const { data: entry, error: entryError } = await supabase
      .from('ledger_entries')
      .insert({
        wallet_id: wallet.id,
        entry_type: 'debit' as LedgerEntryType,
        amount: -amount, // Negative for debits
        balance_after: newBalance,
        source: 'app' as LedgerSource,
        idempotency_key: options.idempotencyKey,
        metadata: { description: options.description, ...options.metadata },
      })
      .select()
      .single();
    
    if (entryError) {
      console.error('Failed to create ledger entry:', entryError);
      return { success: false, error: { code: 'LEDGER_ERROR', message: 'Failed to record transaction' } };
    }
    
    const response: ApiResponse<{ balance: WalletBalance; entry: LedgerEntry }> = {
      success: true,
      data: {
        balance: {
          account_id: accountId,
          balance: newBalance,
          reserved: wallet.reserved,
          available: newBalance - wallet.reserved,
        },
        entry: entry as LedgerEntry,
      },
    };
    
    await this.storeIdempotency(options.idempotencyKey, response);
    
    return response;
  }
  
  /**
   * Reserve tokens for a pending operation
   */
  async reserve(
    accountId: string,
    amount: number,
    options: {
      idempotencyKey: string;
      jobId?: string;
    }
  ): Promise<ApiResponse<{ balance: WalletBalance; reservation_id: string }>> {
    if (amount <= 0) {
      return { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
    }
    
    const supabase = getSupabase();
    
    // Check idempotency
    const cached = await this.checkIdempotency<{ balance: WalletBalance; reservation_id: string }>(options.idempotencyKey);
    if (cached) return cached;
    
    const wallet = await this.getOrCreateWallet(accountId);
    const available = wallet.balance - wallet.reserved;
    
    if (available < amount) {
      return { 
        success: false, 
        error: { 
          code: 'INSUFFICIENT_BALANCE', 
          message: `Insufficient balance. Available: ${available}, Required: ${amount}` 
        } 
      };
    }
    
    const newReserved = wallet.reserved + amount;
    
    // Update reserved amount
    const { error: updateError } = await supabase
      .from('token_wallets')
      .update({ reserved: newReserved, updated_at: new Date().toISOString() })
      .eq('id', wallet.id)
      .eq('reserved', wallet.reserved); // Optimistic lock
    
    if (updateError) {
      return { success: false, error: { code: 'UPDATE_FAILED', message: 'Concurrent modification detected' } };
    }
    
    // Create ledger entry for reserve
    const { data: entry, error: entryError } = await supabase
      .from('ledger_entries')
      .insert({
        wallet_id: wallet.id,
        entry_type: 'reserve' as LedgerEntryType,
        amount,
        balance_after: wallet.balance, // Balance unchanged, just reserved
        source: 'app' as LedgerSource,
        idempotency_key: options.idempotencyKey,
        metadata: { job_id: options.jobId },
      })
      .select()
      .single();
    
    if (entryError) {
      console.error('Failed to create ledger entry:', entryError);
      return { success: false, error: { code: 'LEDGER_ERROR', message: 'Failed to record transaction' } };
    }
    
    const response: ApiResponse<{ balance: WalletBalance; reservation_id: string }> = {
      success: true,
      data: {
        balance: {
          account_id: accountId,
          balance: wallet.balance,
          reserved: newReserved,
          available: wallet.balance - newReserved,
        },
        reservation_id: (entry as LedgerEntry).id,
      },
    };
    
    await this.storeIdempotency(options.idempotencyKey, response);
    
    return response;
  }
  
  /**
   * Release reserved tokens (cancel reservation)
   */
  async release(
    accountId: string,
    amount: number,
    reservationId: string
  ): Promise<ApiResponse<{ balance: WalletBalance }>> {
    if (amount <= 0) {
      return { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
    }
    
    const supabase = getSupabase();
    const wallet = await this.getOrCreateWallet(accountId);
    
    if (wallet.reserved < amount) {
      return { 
        success: false, 
        error: { 
          code: 'INVALID_RELEASE', 
          message: `Cannot release more than reserved. Reserved: ${wallet.reserved}, Release: ${amount}` 
        } 
      };
    }
    
    const newReserved = wallet.reserved - amount;
    
    // Update reserved amount
    const { error: updateError } = await supabase
      .from('token_wallets')
      .update({ reserved: newReserved, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);
    
    if (updateError) {
      return { success: false, error: { code: 'UPDATE_FAILED', message: updateError.message } };
    }
    
    // Create ledger entry for release
    await supabase
      .from('ledger_entries')
      .insert({
        wallet_id: wallet.id,
        entry_type: 'release' as LedgerEntryType,
        amount: -amount,
        balance_after: wallet.balance,
        source: 'app' as LedgerSource,
        metadata: { reservation_id: reservationId },
      });
    
    return {
      success: true,
      data: {
        balance: {
          account_id: accountId,
          balance: wallet.balance,
          reserved: newReserved,
          available: wallet.balance - newReserved,
        },
      },
    };
  }
  
  /**
   * Get transaction history for an account
   */
  async getHistory(accountId: string, limit: number = 50): Promise<LedgerEntry[]> {
    const supabase = getSupabase();
    const wallet = await this.getOrCreateWallet(accountId);
    
    const { data, error } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
    
    return (data || []) as LedgerEntry[];
  }
  
  // Idempotency helpers
  private async checkIdempotency<T>(key: string): Promise<ApiResponse<T> | null> {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('idempotency_keys')
      .select('response')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (data?.response) {
      return data.response as ApiResponse<T>;
    }
    return null;
  }
  
  private async storeIdempotency<T>(key: string, response: ApiResponse<T>): Promise<void> {
    const supabase = getSupabase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await supabase
      .from('idempotency_keys')
      .upsert({
        key,
        response: response as unknown as Record<string, unknown>,
        expires_at: expiresAt.toISOString(),
      });
  }
}

// Singleton instance
export const ledgerService = new LedgerService();
