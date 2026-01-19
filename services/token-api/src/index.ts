// ===========================================
// Token API Service - Main Entry Point
// ===========================================
import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { config } from './config/env.js';
import { verifyApiKey, isPublicRoute } from './middleware/auth.js';
import { extractIdempotencyKey } from './middleware/idempotency.js';

// Routes
import { healthRoutes } from './routes/health.js';
import { balanceRoutes } from './routes/balance.js';
import { tokenRoutes } from './routes/tokens.js';
import { referralRoutes } from './routes/referrals.js';
import { stripeWebhookRoutes } from './routes/webhooks/stripe.js';

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: config.logLevel,
  },
});

// ===========================================
// Plugins
// ===========================================

// CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Idempotency-Key', 'Stripe-Signature'],
});

// Security headers
await fastify.register(helmet);

// Rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return (request.headers['x-api-key'] as string) || request.ip;
  },
});

// ===========================================
// Middleware (Hooks)
// ===========================================

// API Key authentication (skip for public routes)
fastify.addHook('preHandler', async (request, reply) => {
  if (!isPublicRoute(request.url)) {
    await verifyApiKey(request, reply);
  }
});

// Idempotency key extraction
fastify.addHook('preHandler', extractIdempotencyKey);

// ===========================================
// Routes
// ===========================================

// Health checks (no auth required)
await fastify.register(healthRoutes);

// Webhooks (use signature verification instead of API key)
await fastify.register(stripeWebhookRoutes);

// API routes (require API key)
await fastify.register(balanceRoutes);
await fastify.register(tokenRoutes);
await fastify.register(referralRoutes);

// ===========================================
// Error Handler
// ===========================================

fastify.setErrorHandler((error: FastifyError, _request, reply) => {
  fastify.log.error(error);
  
  reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: config.isDevelopment ? error.message : 'Internal server error',
    },
  });
});

// ===========================================
// Start Server
// ===========================================

const start = async () => {
  try {
    await fastify.listen({ 
      port: config.port, 
      host: config.host 
    });
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                   TOKEN API SERVICE                       ║
╠══════════════════════════════════════════════════════════╣
║  Status:  Running                                         ║
║  Port:    ${String(config.port).padEnd(4)}                                          ║
║  Env:     ${config.nodeEnv.padEnd(15)}                         ║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║  • GET  /health              - Health check               ║
║  • GET  /v1/balance/:id      - Get balance                ║
║  • POST /v1/tokens/consume   - Consume tokens             ║
║  • POST /v1/tokens/reserve   - Reserve tokens             ║
║  • POST /v1/tokens/release   - Release reservation        ║
║  • POST /v1/tokens/credit    - Credit tokens              ║
║  • POST /v1/referrals/...    - Referral operations        ║
║  • POST /webhooks/stripe     - Stripe webhooks            ║
╚══════════════════════════════════════════════════════════╝
    `);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await fastify.close();
    process.exit(0);
  });
});
