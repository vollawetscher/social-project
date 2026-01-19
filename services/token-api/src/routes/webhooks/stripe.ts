// ===========================================
// Stripe Webhook Handler
// POST /webhooks/stripe
// ===========================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripeService } from '../../services/stripe.service.js';
import Stripe from 'stripe';

export async function stripeWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Register raw body parser for webhook signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );
  
  fastify.post(
    '/webhooks/stripe',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string;
      
      if (!signature) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Stripe-Signature header is required',
          },
        });
      }
      
      // Verify webhook signature
      const event = stripeService.verifyWebhookSignature(
        request.body as Buffer,
        signature
      );
      
      if (!event) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Webhook signature verification failed',
          },
        });
      }
      
      console.log(`Received Stripe event: ${event.type} (${event.id})`);
      
      // Handle different event types
      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const result = await stripeService.handleCheckoutCompleted(session);
            console.log('Checkout completed:', result);
            break;
          }
          
          case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const result = await stripeService.handlePaymentSucceeded(paymentIntent);
            console.log('Payment succeeded:', result);
            break;
          }
          
          case 'charge.refunded': {
            const charge = event.data.object as Stripe.Charge;
            const result = await stripeService.handleRefund(charge);
            console.log('Charge refunded:', result);
            break;
          }
          
          default:
            console.log(`Unhandled event type: ${event.type}`);
        }
        
        // Acknowledge receipt of the event
        return reply.status(200).send({ received: true });
        
      } catch (err) {
        const error = err as Error;
        console.error('Error processing webhook:', error);
        
        // Return 200 to prevent Stripe from retrying
        return reply.status(200).send({ 
          received: true, 
          error: error.message 
        });
      }
    }
  );
}
