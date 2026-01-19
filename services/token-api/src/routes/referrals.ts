// ===========================================
// Referral Routes
// POST /v1/referrals/generate, /attribute, /convert
// GET /v1/referrals/:code, /v1/referrals/stats/:accountId
// ===========================================
import { FastifyInstance } from 'fastify';
import { referralService } from '../services/referral.service.js';
import type { 
  GenerateReferralRequest,
  AttributeReferralRequest,
  ConvertReferralRequest 
} from '../types/index.js';

interface CodeParams {
  code: string;
}

interface AccountParams {
  accountId: string;
}

export async function referralRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Generate a new referral code
  fastify.post<{ Body: GenerateReferralRequest }>(
    '/v1/referrals/generate',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            owner_account_id: { type: 'string' },
            campaign: { type: 'string' },
            reward_tokens: { type: 'number', minimum: 0 },
          },
          required: ['owner_account_id'],
        },
      },
    },
    async (request) => {
      const { owner_account_id, campaign, reward_tokens } = request.body;
      
      return referralService.generateCode(owner_account_id, {
        campaign,
        rewardTokens: reward_tokens,
      });
    }
  );
  
  // Validate and get referral code details
  fastify.get<{ Params: CodeParams }>(
    '/v1/referrals/:code',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
      },
    },
    async (request) => {
      const { code } = request.params;
      return referralService.validateCode(code);
    }
  );
  
  // Attribute a referral (record that user came via referral)
  fastify.post<{ Body: AttributeReferralRequest }>(
    '/v1/referrals/attribute',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            referral_code: { type: 'string' },
            referred_account_id: { type: 'string' },
          },
          required: ['referral_code', 'referred_account_id'],
        },
      },
    },
    async (request) => {
      const { referral_code, referred_account_id } = request.body;
      return referralService.attribute(referral_code, referred_account_id);
    }
  );
  
  // Convert a referral (trigger reward on first purchase)
  fastify.post<{ Body: ConvertReferralRequest }>(
    '/v1/referrals/convert',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            referred_account_id: { type: 'string' },
            reward_tokens: { type: 'number', minimum: 0 },
          },
          required: ['referred_account_id', 'reward_tokens'],
        },
      },
    },
    async (request) => {
      const { referred_account_id, reward_tokens } = request.body;
      return referralService.convert(referred_account_id, reward_tokens);
    }
  );
  
  // Get referral stats for an account
  fastify.get<{ Params: AccountParams }>(
    '/v1/referrals/stats/:accountId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
          },
          required: ['accountId'],
        },
      },
    },
    async (request) => {
      const { accountId } = request.params;
      return referralService.getStats(accountId);
    }
  );
  
  // Deactivate a referral code
  fastify.delete<{ Params: CodeParams; Body: { owner_account_id: string } }>(
    '/v1/referrals/:code',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
        body: {
          type: 'object',
          properties: {
            owner_account_id: { type: 'string' },
          },
          required: ['owner_account_id'],
        },
      },
    },
    async (request) => {
      const { code } = request.params;
      const { owner_account_id } = request.body;
      return referralService.deactivateCode(code, owner_account_id);
    }
  );
}
