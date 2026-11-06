import { describe, it, expect } from 'vitest';
import {
  startAuth,
  validateCallback,
  isAuthorizedOperator,
  registerOperator,
} from '../src/index.js';

describe('world-auth package', () => {
  it('starts an auth session with random state and nonce', () => {
    const session = startAuth({
      clientId: 'app_test_quoteseal',
      redirectUri: 'http://localhost:3001/world/callback',
    });

    expect(session.state).toBeDefined();
    expect(session.url).toContain('response_type=code');
    expect(session.url).toContain('client_id=app_test_quoteseal');
  });

  it('validates authorized operator successfully', async () => {
    const session = startAuth({
      clientId: 'app_test_quoteseal',
      redirectUri: 'http://localhost:3001/world/callback',
    });

    const res = await validateCallback({
      code: 'demo_cfo_code',
      state: session.state,
    });

    expect(res.valid).toBe(true);
    expect(res.subject).toBe('sub_world_treasury_demo');
    expect(res.operator?.role).toBe('ROTATION_APPROVER');
  });

  it('T9: rejects unauthorized or denied operator code', async () => {
    // 1. Explicit denial error from World UI
    const session1 = startAuth({
      clientId: 'app_test',
      redirectUri: 'http://localhost:3001/callback',
    });

    const resDenied = await validateCallback({
      code: '',
      state: session1.state,
      error: 'access_denied',
      error_description: 'User cancelled Agent Pass consent',
    });

    expect(resDenied.valid).toBe(false);
    expect(resDenied.error).toContain('access_denied');

    // 2. Valid login but not an authorized operator role
    const session2 = startAuth({
      clientId: 'app_test',
      redirectUri: 'http://localhost:3001/callback',
    });

    const resUnauthorized = await validateCallback({
      code: 'unauthorized_code',
      state: session2.state,
    });

    expect(resUnauthorized.valid).toBe(false);
    expect(resUnauthorized.error).toContain('not an authorized rotation approver');
  });
});
