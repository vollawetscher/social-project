// ===========================================
// Token Operations Routes
// POST /v1/tokens/consume, /reserve, /release, /credit
// ===========================================
import { FastifyInstance } from 'fastify';
import { ledgerService } from '../services/ledger.service.js';
import type { 
  ConsumeTokensRequest, 
  ReserveTokensRequest, 
  ReleaseTokensRequest,
  CreditTokensRequest 
} from '../types/index.js';

export async function tokenRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Consume (debit) tokens
  fastify.post<{ Body: ConsumeTokensRequest }>(
    '/v1/tokens/consume',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            idempotency_key: { type: 'string' },
            description: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['account_id', 'amount', 'idempotency_key'],
        },
      },
    },
    async (request) => {
      const { account_id, amount, idempotency_key, description, metadata } = request.body;
      
      return ledgerService.consume(account_id, amount, {
        idempotencyKey: idempotency_key,
        description,
        metadata,
      });
    }
  );
  
  // Reserve tokens for pending operation
  fastify.post<{ Body: ReserveTokensRequest }>(
    '/v1/tokens/reserve',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            idempotency_key: { type: 'string' },
            job_id: { type: 'string' },
          },
          required: ['account_id', 'amount', 'idempotency_key'],
        },
      },
    },
    async (request) => {
      const { account_id, amount, idempotency_key, job_id } = request.body;
      
      return ledgerService.reserve(account_id, amount, {
        idempotencyKey: idempotency_key,
        jobId: job_id,
      });
    }
  );
  
  // Release reserved tokens
  fastify.post<{ Body: ReleaseTokensRequest }>(
    '/v1/tokens/release',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            reservation_id: { type: 'string' },
          },
          required: ['account_id', 'amount', 'reservation_id'],
        },
      },
    },
    async (request) => {
      const { account_id, amount, reservation_id } = request.body;
      
      return ledgerService.release(account_id, amount, reservation_id);
    }
  );
  
  // Credit tokens (admin/internal use)
  fastify.post<{ Body: CreditTokensRequest }>(
    '/v1/tokens/credit',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            source: { type: 'string', enum: ['stripe', 'referral', 'manual', 'app', 'system'] },
            source_reference: { type: 'string' },
            idempotency_key: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['account_id', 'amount', 'source', 'idempotency_key'],
        },
      },
    },
    async (request) => {
      const { account_id, amount, source, source_reference, idempotency_key, metadata } = request.body;
      
      return ledgerService.credit(account_id, amount, source, {
        sourceReference: source_reference,
        idempotencyKey: idempotency_key,
        metadata,
      });
    }
  );
}
