// ===========================================
// Stripe Service
// Handles Stripe webhook processing and payment verification
// ===========================================
import Stripe from 'stripe';
import { config } from '../config/env.js';
import { ledgerService } from './ledger.service.js';
import type { ApiResponse } from '../types/index.js';

// Initialize Stripe with secret key
const stripe = new Stripe(config.stripeSecretKey);

export class StripeService {
  
  /**
   * Verify webhook signature and parse event
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripeWebhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return null;
    }
  }
  
  /**
   * Handle checkout.session.completed event
   * Credits tokens to user after successful payment
   */
  async handleCheckoutCompleted(
    session: Stripe.Checkout.Session
  ): Promise<ApiResponse<{ credited: boolean; amount?: number }>> {
    // Extract account_id from metadata (must be set when creating checkout)
    const accountId = session.metadata?.account_id;
    const tokensAmount = parseInt(session.metadata?.tokens || '0', 10);
    
    if (!accountId) {
      console.error('No account_id in session metadata:', session.id);
      return { 
        success: false, 
        error: { code: 'MISSING_ACCOUNT', message: 'No account_id in session metadata' } 
      };
    }
    
    if (tokensAmount <= 0) {
      console.error('Invalid tokens amount in session metadata:', session.id);
      return { 
        success: false, 
        error: { code: 'INVALID_TOKENS', message: 'Invalid tokens amount' } 
      };
    }
    
    // Credit tokens (idempotent via payment_intent)
    const paymentIntentId = typeof session.payment_intent === 'string' 
      ? session.payment_intent 
      : session.payment_intent?.id || session.id;
    
    const result = await ledgerService.credit(
      accountId,
      tokensAmount,
      'stripe',
      {
        sourceReference: paymentIntentId,
        idempotencyKey: `stripe-${paymentIntentId}`,
        metadata: {
          checkout_session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
        },
      }
    );
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }
    
    return {
      success: true,
      data: {
        credited: true,
        amount: tokensAmount,
      },
    };
  }
  
  /**
   * Handle payment_intent.succeeded event (alternative to checkout)
   */
  async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<ApiResponse<{ credited: boolean; amount?: number }>> {
    const accountId = paymentIntent.metadata?.account_id;
    const tokensAmount = parseInt(paymentIntent.metadata?.tokens || '0', 10);
    
    if (!accountId || tokensAmount <= 0) {
      // Might be a payment not related to tokens
      return { success: true, data: { credited: false } };
    }
    
    const result = await ledgerService.credit(
      accountId,
      tokensAmount,
      'stripe',
      {
        sourceReference: paymentIntent.id,
        idempotencyKey: `stripe-${paymentIntent.id}`,
        metadata: {
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
        },
      }
    );
    
    return {
      success: result.success,
      data: { credited: result.success, amount: tokensAmount },
      error: result.error,
    };
  }
  
  /**
   * Handle charge.refunded event
   * Deducts tokens if a payment was refunded
   */
  async handleRefund(charge: Stripe.Charge): Promise<ApiResponse<{ refunded: boolean }>> {
    const accountId = charge.metadata?.account_id;
    const tokensAmount = parseInt(charge.metadata?.tokens || '0', 10);
    
    if (!accountId || tokensAmount <= 0) {
      return { success: true, data: { refunded: false } };
    }
    
    // Note: In production, you might want to handle partial refunds differently
    // For now, we assume full refund = deduct all tokens from that purchase
    
    const { getSupabase } = await import('../db/supabase.js');
    const supabase = getSupabase();
    
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
    
    // Find the original credit entry
    const { data: originalEntry } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('source_reference', paymentIntentId)
      .eq('entry_type', 'credit')
      .single();
    
    if (!originalEntry) {
      console.warn('No original credit entry found for refund:', charge.id);
      return { success: true, data: { refunded: false } };
    }
    
    // Get wallet
    const { data: wallet } = await supabase
      .from('token_wallets')
      .select('*')
      .eq('id', originalEntry.wallet_id)
      .single();
    
    if (!wallet) {
      return { success: false, error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' } };
    }
    
    const refundAmount = Math.min(tokensAmount, wallet.balance);
    const newBalance = wallet.balance - refundAmount;
    
    // Update wallet
    await supabase
      .from('token_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);
    
    // Record refund in ledger
    await supabase
      .from('ledger_entries')
      .insert({
        wallet_id: wallet.id,
        entry_type: 'refund',
        amount: -refundAmount,
        balance_after: newBalance,
        source: 'stripe',
        source_reference: charge.id,
        idempotency_key: `refund-${charge.id}`,
        metadata: { original_charge: paymentIntentId },
      });
    
    return {
      success: true,
      data: { refunded: true },
    };
  }
  
  /**
   * Create a checkout session for purchasing tokens
   * This is called by the host app to get a payment link
   */
  async createCheckoutSession(
    accountId: string,
    tokensAmount: number,
    priceInCents: number,
    currency: string = 'usd',
    successUrl: string,
    cancelUrl: string
  ): Promise<ApiResponse<{ checkout_url: string; session_id: string }>> {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `${tokensAmount} Tokens`,
                description: `Purchase ${tokensAmount} tokens for your account`,
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          account_id: accountId,
          tokens: tokensAmount.toString(),
        },
      });
      
      return {
        success: true,
        data: {
          checkout_url: session.url!,
          session_id: session.id,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: { code: 'STRIPE_ERROR', message: error.message },
      };
    }
  }
}

// Singleton instance
export const stripeService = new StripeService();
