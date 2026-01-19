// ===========================================
// Idempotency Key Middleware
// Ensures POST/PUT/DELETE requests with same key return same response
// ===========================================
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    idempotencyKey?: string;
  }
}

/**
 * Extract idempotency key from header
 * Required for mutating operations
 */
export async function extractIdempotencyKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only required for POST, PUT, DELETE
  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) {
    return;
  }
  
  // Skip for webhooks (they use their own idempotency via event IDs)
  if (request.url.startsWith('/webhooks/')) {
    return;
  }
  
  const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
  
  if (idempotencyKey) {
    // Validate key format (should be reasonable length)
    if (idempotencyKey.length > 256) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency key too long (max 256 characters)',
        },
      });
    }
    request.idempotencyKey = idempotencyKey;
  }
  
  // Note: We don't require idempotency keys, but recommend them
  // The services will handle idempotency if a key is provided
}

/**
 * Validate that critical operations have idempotency key
 */
export function requireIdempotencyKey(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (!request.idempotencyKey) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key header is required for this operation',
      },
    });
  }
}
