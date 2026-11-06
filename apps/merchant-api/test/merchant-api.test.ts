import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('merchant-api', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('GET /api/research/paid without signature returns 402 with challenge', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/research/paid' });
    expect(res.statusCode).toBe(402);
    const body = res.json();
    expect(body.error).toBe('Payment Required');
    expect(body.payment.payTo).toBeDefined();
    expect(res.headers['payment-required']).toBeDefined();
  });

  it('GET /api/research/paid with signature returns 200 and data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/research/paid',
      headers: {
        'payment-signature': 'mock_valid_signature_proof',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('success');
    expect(res.json().reportId).toBe('REP-ETH-MUMBAI-2026');
  });
});
