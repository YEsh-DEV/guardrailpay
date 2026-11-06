import { buildApp } from './app.js';
import { createLogger } from '@quoteseal/shared';

const logger = createLogger('MerchantAPI');
const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  const app = buildApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`Merchant API running on http://localhost:${PORT}`);
    logger.info(`x402 Paid Endpoint: http://localhost:${PORT}/api/research/paid`);
  } catch (err: unknown) {
    logger.error(`Server failed to start: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
