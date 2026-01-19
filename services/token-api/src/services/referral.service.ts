// ===========================================
// Referral Service
// Handles referral code generation, attribution, and rewards
// ===========================================
import { getSupabase } from '../db/supabase.js';
import { ledgerService } from './ledger.service.js';
import { nanoid } from 'nanoid';
import type { 
  ReferralCode, 
  ReferralAttribution, 
  ApiResponse 
} from '../types/index.js';

export class ReferralService {
  
  /**
   * Generate a new referral code for an account
   */
  async generateCode(
    ownerAccountId: string,
    options: {
      campaign?: string;
      rewardTokens?: number;
    } = {}
  ): Promise<ApiResponse<{ code: ReferralCode }>> {
    const supabase = getSupabase();
    
    // Generate unique code (8 characters, URL-safe)
    const code = nanoid(8);
    
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({
        code,
        owner_account_id: ownerAccountId,
        campaign: options.campaign || null,
        reward_tokens: options.rewardTokens || 0,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      // Handle unique constraint violation (regenerate code)
      if (error.code === '23505') {
        return this.generateCode(ownerAccountId, options);
      }
      return { 
        success: false, 
        error: { code: 'CREATE_FAILED', message: error.message } 
      };
    }
    
    return {
      success: true,
      data: { code: data as ReferralCode },
    };
  }
  
  /**
   * Validate and get referral code details
   */
  async validateCode(code: string): Promise<ApiResponse<{ code: ReferralCode }>> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return { 
        success: false, 
        error: { code: 'INVALID_CODE', message: 'Referral code not found or inactive' } 
      };
    }
    
    return {
      success: true,
      data: { code: data as ReferralCode },
    };
  }
  
  /**
   * Attribute a referral - record that a user came via a referral code
   */
  async attribute(
    referralCode: string,
    referredAccountId: string
  ): Promise<ApiResponse<{ attribution: ReferralAttribution }>> {
    const supabase = getSupabase();
    
    // Validate the code first
    const codeResult = await this.validateCode(referralCode);
    if (!codeResult.success || !codeResult.data) {
      return { 
        success: false, 
        error: codeResult.error || { code: 'INVALID_CODE', message: 'Invalid code' }
      };
    }
    
    const codeData = codeResult.data.code;
    
    // Check if user was already referred (can only be referred once)
    const { data: existing } = await supabase
      .from('referral_attributions')
      .select('*')
      .eq('referred_account_id', referredAccountId)
      .single();
    
    if (existing) {
      return { 
        success: false, 
        error: { code: 'ALREADY_REFERRED', message: 'This account has already been referred' } 
      };
    }
    
    // Prevent self-referral
    if (codeData.owner_account_id === referredAccountId) {
      return { 
        success: false, 
        error: { code: 'SELF_REFERRAL', message: 'Cannot refer yourself' } 
      };
    }
    
    // Create attribution
    const { data: attribution, error } = await supabase
      .from('referral_attributions')
      .insert({
        referral_code_id: codeData.id,
        referred_account_id: referredAccountId,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) {
      return { 
        success: false, 
        error: { code: 'ATTRIBUTION_FAILED', message: error.message } 
      };
    }
    
    return {
      success: true,
      data: { attribution: attribution as ReferralAttribution },
    };
  }
  
  /**
   * Convert a referral - triggered when referred user makes their first purchase
   * Rewards the referrer with tokens
   */
  async convert(
    referredAccountId: string,
    rewardTokens: number
  ): Promise<ApiResponse<{ rewarded: boolean; referrer_account_id?: string; tokens_awarded?: number }>> {
    const supabase = getSupabase();
    
    // Find pending attribution for this user
    const { data: attribution, error: findError } = await supabase
      .from('referral_attributions')
      .select('*, referral_codes(*)')
      .eq('referred_account_id', referredAccountId)
      .eq('status', 'pending')
      .single();
    
    if (findError || !attribution) {
      // No pending referral - that's OK, not everyone comes via referral
      return {
        success: true,
        data: { rewarded: false },
      };
    }
    
    // Type assertion for the joined data
    const referralCode = (attribution as { referral_codes: ReferralCode }).referral_codes;
    
    // Mark as converted
    const { error: updateError } = await supabase
      .from('referral_attributions')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
      })
      .eq('id', attribution.id);
    
    if (updateError) {
      return { 
        success: false, 
        error: { code: 'UPDATE_FAILED', message: updateError.message } 
      };
    }
    
    // Determine reward amount (use passed amount, fall back to code default)
    const tokensToAward = rewardTokens > 0 ? rewardTokens : referralCode.reward_tokens;
    
    if (tokensToAward > 0) {
      // Credit tokens to referrer
      const creditResult = await ledgerService.credit(
        referralCode.owner_account_id,
        tokensToAward,
        'referral',
        {
          sourceReference: attribution.id,
          idempotencyKey: `referral-reward-${attribution.id}`,
          metadata: {
            referred_account_id: referredAccountId,
            referral_code: referralCode.code,
          },
        }
      );
      
      if (!creditResult.success) {
        console.error('Failed to credit referral reward:', creditResult.error);
      }
      
      // Mark reward as paid
      await supabase
        .from('referral_attributions')
        .update({
          status: 'rewarded',
          reward_paid_at: new Date().toISOString(),
        })
        .eq('id', attribution.id);
    }
    
    return {
      success: true,
      data: {
        rewarded: tokensToAward > 0,
        referrer_account_id: referralCode.owner_account_id,
        tokens_awarded: tokensToAward,
      },
    };
  }
  
  /**
   * Get referral stats for an account (how many people they've referred)
   */
  async getStats(ownerAccountId: string): Promise<ApiResponse<{
    total_referrals: number;
    converted: number;
    pending: number;
    total_tokens_earned: number;
    codes: ReferralCode[];
  }>> {
    const supabase = getSupabase();
    
    // Get all codes for this owner
    const { data: codes, error: codesError } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('owner_account_id', ownerAccountId);
    
    if (codesError) {
      return { 
        success: false, 
        error: { code: 'FETCH_FAILED', message: codesError.message } 
      };
    }
    
    if (!codes || codes.length === 0) {
      return {
        success: true,
        data: {
          total_referrals: 0,
          converted: 0,
          pending: 0,
          total_tokens_earned: 0,
          codes: [],
        },
      };
    }
    
    // Get attributions for these codes
    const codeIds = (codes as ReferralCode[]).map(c => c.id);
    const { data: attributions } = await supabase
      .from('referral_attributions')
      .select('*')
      .in('referral_code_id', codeIds);
    
    const attrList = (attributions || []) as ReferralAttribution[];
    
    const stats = {
      total_referrals: attrList.length,
      converted: attrList.filter(a => a.status === 'converted' || a.status === 'rewarded').length,
      pending: attrList.filter(a => a.status === 'pending').length,
      total_tokens_earned: 0,
      codes: codes as ReferralCode[],
    };
    
    // Calculate total tokens earned from referrals
    const { data: referralEntries } = await supabase
      .from('ledger_entries')
      .select('amount')
      .eq('source', 'referral');
    
    if (referralEntries) {
      stats.total_tokens_earned = (referralEntries as { amount: number }[]).reduce((sum, e) => sum + e.amount, 0);
    }
    
    return {
      success: true,
      data: stats,
    };
  }
  
  /**
   * Deactivate a referral code
   */
  async deactivateCode(code: string, ownerAccountId: string): Promise<ApiResponse<{ deactivated: boolean }>> {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('referral_codes')
      .update({ is_active: false })
      .eq('code', code)
      .eq('owner_account_id', ownerAccountId);
    
    if (error) {
      return { 
        success: false, 
        error: { code: 'UPDATE_FAILED', message: error.message } 
      };
    }
    
    return {
      success: true,
      data: { deactivated: true },
    };
  }
}

// Singleton instance
export const referralService = new ReferralService();
