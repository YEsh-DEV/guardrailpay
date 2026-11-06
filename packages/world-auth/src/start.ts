import { randomBytes } from 'crypto';

export interface WorldAuthRequestConfig {
  issuer?: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
}

export interface AuthSession {
  url: string;
  state: string;
  nonce: string;
  createdAt: number;
}

const activeSessions = new Map<string, AuthSession>();

export function startAuth(config: WorldAuthRequestConfig): AuthSession {
  const state = randomBytes(16).toString('hex');
  const nonce = randomBytes(16).toString('hex');
  const issuer = config.issuer || 'https://auth.world.org';
  const scope = config.scope || 'openid profile';

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope,
    state,
    nonce,
  });

  const url = `${issuer}/authorize?${params.toString()}`;
  const session: AuthSession = {
    url,
    state,
    nonce,
    createdAt: Date.now(),
  };

  activeSessions.set(state, session);
  return session;
}

export function getSession(state: string): AuthSession | undefined {
  return activeSessions.get(state);
}

export function consumeSession(state: string): AuthSession | undefined {
  const session = activeSessions.get(state);
  if (session) {
    activeSessions.delete(state);
  }
  return session;
}
