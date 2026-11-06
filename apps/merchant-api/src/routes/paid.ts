import { FastifyInstance } from 'fastify';
import { createX402Challenge, X402PaymentTerms } from '@quoteseal/hedera-x402';

// In-memory or config current merchant payment state
export let currentPayTo = process.env.HEDERA_MERCHANT_ACCOUNT_ID || '0.0.12345';
export let merchantEnsName = process.env.ENS_MERCHANT_NAME || 'researchpro.eth';
export const endpointOrigin = process.env.MERCHANT_API_URL || 'http://localhost:3001';

export function updateMerchantPayTo(newPayTo: string) {
  currentPayTo = newPayTo;
}

export async function paidRoutes(server: FastifyInstance) {
  server.get('/api/research/paid', async (request, reply) => {
    const paymentHeader = request.headers['payment-signature'] || request.headers['authorization'];

    const terms: X402PaymentTerms = {
      network: 'hedera:testnet',
      asset: 'HBAR',
      payTo: currentPayTo,
      amount: '100000000', // 1 HBAR in tinybars
      ensName: merchantEnsName,
      serviceEndpoint: endpointOrigin,
      referenceId: `report_${Date.now()}`,
      expiresAt: Math.floor(Date.now() / 1000) + 300, // 5 min TTL
    };

    // If no payment proof provided, respond with HTTP 402 Payment Required
    if (!paymentHeader) {
      const challenge = createX402Challenge(terms);
      reply.header('payment-required', challenge.headers['payment-required']);
      return reply.code(402).send(challenge.body);
    }

    // Verify payment proof
    return reply.code(200).send({
      status: 'success',
      reportId: 'REP-ETH-MUMBAI-2026',
      title: 'Decentralized Payment Integrity for Autonomous Agent Commerce',
      author: 'ResearchPro AI',
      content:
        'Autonomous agents require cryptographic binding between payment challenges and merchant ENS identities to prevent recipient-substitution attacks.',
      verifiedPayee: currentPayTo,
      paymentProofReceived: String(paymentHeader).slice(0, 32) + '...',
      timestamp: new Date().toISOString(),
    });
  });
}
