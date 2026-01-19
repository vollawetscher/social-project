// ===========================================
// Health Check Routes
// ===========================================
import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'token-api',
      version: '1.0.0',
    };
  });
  
  fastify.get('/health/ready', async () => {
    // Could add DB connectivity check here
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  });
}
