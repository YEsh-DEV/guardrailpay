import { FastifyInstance } from 'fastify';

let challengeRecord = {
  domain: 'api.researchpro.com',
  ensName: 'researchpro.eth',
  challengeToken: 'quoteseal-domain-verify-8f92a10c7',
  verifiedAt: new Date().toISOString(),
};

export async function wellknownRoutes(server: FastifyInstance) {
  // RFC /.well-known endpoint for domain proof
  server.get('/.well-known/quoteseal.json', async () => {
    return challengeRecord;
  });

  server.post('/api/onboard/challenge', async (request) => {
    const body = (request.body as { ensName: string; domain: string }) || {};
    challengeRecord = {
      domain: body.domain || 'localhost',
      ensName: body.ensName || 'researchpro.eth',
      challengeToken: `quoteseal-domain-verify-${Date.now().toString(16)}`,
      verifiedAt: new Date().toISOString(),
    };
    return { success: true, challenge: challengeRecord };
  });
}
