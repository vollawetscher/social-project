// ===========================================
// Balance Routes
// GET /v1/balance/:accountId
// ===========================================
import { FastifyInstance, FastifyRequest } from 'fastify';
import { ledgerService } from '../services/ledger.service.js';

interface BalanceParams {
  accountId: string;
}

interface HistoryQuery {
  limit?: string;
}

export async function balanceRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Get balance for an account
  fastify.get<{ Params: BalanceParams }>(
    '/v1/balance/:accountId',
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
      
      try {
        const balance = await ledgerService.getBalance(accountId);
        return {
          success: true,
          data: balance,
        };
      } catch (error) {
        const err = error as Error;
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: err.message,
          },
        };
      }
    }
  );
  
  // Get transaction history for an account
  fastify.get<{ Params: BalanceParams; Querystring: HistoryQuery }>(
    '/v1/balance/:accountId/history',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
          },
          required: ['accountId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string' },
          },
        },
      },
    },
    async (request) => {
      const { accountId } = request.params;
      const limit = parseInt(request.query.limit || '50', 10);
      
      try {
        const history = await ledgerService.getHistory(accountId, limit);
        return {
          success: true,
          data: { entries: history },
        };
      } catch (error) {
        const err = error as Error;
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: err.message,
          },
        };
      }
    }
  );
}
