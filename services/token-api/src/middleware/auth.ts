// ===========================================
// API Key Authentication Middleware
// ===========================================
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyValid?: boolean;
  }
}

/**
 * Verify API key from X-API-Key header
 */
export async function verifyApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'X-API-Key header is required',
      },
    });
  }
  
  if (apiKey !== config.apiKey) {
    return reply.status(403).send({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    });
  }
  
  request.apiKeyValid = true;
}

/**
 * Skip auth for certain routes (webhooks use signature verification instead)
 */
export function isPublicRoute(url: string): boolean {
  const publicRoutes = [
    '/health',
    '/webhooks/stripe',
  ];
  return publicRoutes.some(route => url.startsWith(route));
}
