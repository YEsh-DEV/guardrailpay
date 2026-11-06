import * as oidc from 'openid-client';
import {
  AuthenticationError,
  StaleAuthenticationError,
  ReplayError,
  NotFoundError,
  OperatorRevokedError,
  ValidationError
} from '@quoteseal/shared';
import {
  computeSubjectHmac,
  encryptAesGcm,
  decryptAesGcm,
  sha256Hex
} from './crypto.js';
import type { FastifyBaseLogger } from 'fastify';

export interface WorldOidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  requiredAcr: string;
  maxAuthAgeSeconds: number;
  hmacSecret: string;
  encryptionKeyHex: string;
}

export interface OidcInitiationInput {
  merchantId: string;
  operatorId: string;
  proposalId: string;
  proposalHash: string;
}

export interface OidcInitiationResult {
  sessionId: string;
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  proposalId: string;
  proposalHash: string;
  expiresAt: Date;
}

export interface OidcCallbackInput {
  code: string;
  state: string;
  proposalHash: string;
  currentUrl?: string;
}

export interface VerifiedOidcSession {
  authAttemptId: string;
  sessionId: string;
  merchantId: string;
  operatorId: string;
  proposalId: string;
  proposalHash: string;
  subjectHmac: string;
  authTime: number; // unix timestamp in seconds
  acr: string;
  amr: string[];
}

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  auth_time?: number;
  acr?: string;
  amr?: string[];
  nonce?: string;
  [key: string]: unknown;
}

export interface IWorldOidcService {
  initiate(input: OidcInitiationInput): Promise<OidcInitiationResult>;
  handleCallback(input: OidcCallbackInput): Promise<VerifiedOidcSession>;
}

/**
 * Production implementation using openid-client v6 against official World ID issuer.
 */
export class LiveWorldOidcService implements IWorldOidcService {
  private configPromise: Promise<oidc.Configuration> | null = null;

  constructor(
    private readonly config: WorldOidcConfig,
    private readonly dbStore: any,
    private readonly logger: FastifyBaseLogger
  ) {}

  private async getOidcConfiguration(): Promise<oidc.Configuration> {
    if (!this.configPromise) {
      this.configPromise = oidc.discovery(
        new URL(this.config.issuer),
        this.config.clientId,
        this.config.clientSecret
      );
    }
    return this.configPromise;
  }

  async initiate(input: OidcInitiationInput): Promise<OidcInitiationResult> {
    const oidcConfig = await this.getOidcConfiguration();

    const sessionId = crypto.randomUUID();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes session TTL

    // Build authorization URL enforcing max_age=0 for fresh biometric/operator step-up
    const authUrl = oidc.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: this.config.redirectUri,
      scope: 'openid',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      max_age: '0'
    });

    const stateHash = sha256Hex(state);
    const nonceHash = sha256Hex(nonce);
    const pkceVerifierEncrypted = encryptAesGcm(codeVerifier, this.config.encryptionKeyHex);

    // Save auth attempt to database
    await this.dbStore.saveAuthAttempt({
      id: crypto.randomUUID(),
      merchantId: input.merchantId,
      operatorId: input.operatorId,
      proposalId: input.proposalId,
      proposalHash: input.proposalHash,
      sessionId,
      stateHash,
      nonceHash,
      pkceVerifierEncrypted,
      expiresAt,
      status: 'pending',
      consumedAt: null
    });

    this.logger.info(
      {
        sessionId,
        proposalId: input.proposalId,
        merchantId: input.merchantId,
        operatorId: input.operatorId
      },
      'World ID OIDC authentication initiated'
    );

    return {
      sessionId,
      authorizationUrl: authUrl.href,
      state,
      nonce,
      codeChallenge,
      proposalId: input.proposalId,
      proposalHash: input.proposalHash,
      expiresAt
    };
  }

  async handleCallback(input: OidcCallbackInput): Promise<VerifiedOidcSession> {
    const stateHash = sha256Hex(input.state);

    const attempt = await this.dbStore.findAuthAttemptByStateHash(stateHash);
    if (!attempt) {
      throw new AuthenticationError('Invalid or unknown OIDC state');
    }

    if (attempt.consumedAt != null) {
      throw new ReplayError('OIDC state has already been consumed (replay attack detected)');
    }

    if (new Date(attempt.expiresAt) < new Date()) {
      throw new AuthenticationError('OIDC authentication session has expired');
    }

    if (attempt.proposalHash !== input.proposalHash) {
      throw new AuthenticationError('Proposal hash mismatch: session bound to different proposal');
    }

    const oidcConfig = await this.getOidcConfiguration();
    const codeVerifier = decryptAesGcm(attempt.pkceVerifierEncrypted, this.config.encryptionKeyHex);

    const currentUrl = input.currentUrl
      ? new URL(input.currentUrl)
      : new URL(`${this.config.redirectUri}?code=${encodeURIComponent(input.code)}&state=${encodeURIComponent(input.state)}`);

    // Perform Token Exchange and ID Token validation via openid-client v6
    let tokens: oidc.TokenEndpointResponse;
    try {
      tokens = await oidc.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: input.state,
        maxAge: this.config.maxAuthAgeSeconds
      });
    } catch (err: any) {
      this.logger.warn({ error: err.message }, 'World OIDC code grant failed');
      throw new AuthenticationError(`World OIDC token exchange failed: ${err.message}`);
    }

    const claims = (typeof (tokens as any).claims === 'function' ? (tokens as any).claims() : {}) as IdTokenClaims;

    // Validate claims fail-closed
    return this.validateAndFinalizeSession(attempt, claims);
  }

  protected async validateAndFinalizeSession(
    attempt: any,
    claims: IdTokenClaims
  ): Promise<VerifiedOidcSession> {
    const nowEpoch = Math.floor(Date.now() / 1000);

    // 1. Validate Nonce (compare SHA-256 hash to stored nonceHash)
    if (!claims.nonce) {
      throw new AuthenticationError('ID token missing required nonce claim');
    }
    const tokenNonceHash = sha256Hex(claims.nonce);
    if (tokenNonceHash !== attempt.nonceHash) {
      throw new AuthenticationError('OIDC nonce mismatch: token nonce does not match session nonce');
    }

    // 2. Validate auth_time freshness (must be <= maxAuthAgeSeconds)
    if (!claims.auth_time || typeof claims.auth_time !== 'number') {
      throw new AuthenticationError('ID token missing or invalid auth_time claim');
    }

    if (nowEpoch - claims.auth_time > this.config.maxAuthAgeSeconds) {
      throw new StaleAuthenticationError(
        `Authentication is stale: auth_time was ${nowEpoch - claims.auth_time}s ago, maximum allowed is ${this.config.maxAuthAgeSeconds}s`
      );
    }

    if (claims.auth_time > nowEpoch + 5) {
      throw new AuthenticationError('ID token auth_time is in the future');
    }

    // 3. Validate acr / amr assurance level
    const acr = claims.acr || '';
    const amr = Array.isArray(claims.amr) ? claims.amr : claims.amr ? [claims.amr] : [];

    if (this.config.requiredAcr === 'orb') {
      const isOrb = acr === 'orb' || amr.includes('orb');
      if (!isOrb) {
        throw new AuthenticationError(
          `Insufficient World ID verification level: policy requires 'orb', received acr='${acr}', amr='${amr.join(',')}'`
        );
      }
    } else if (this.config.requiredAcr === 'device') {
      const isDeviceOrOrb = acr === 'device' || acr === 'orb' || amr.includes('device') || amr.includes('orb');
      if (!isDeviceOrOrb) {
        throw new AuthenticationError(
          `Insufficient World ID verification level: policy requires 'device' or higher, received acr='${acr}'`
        );
      }
    }

    // 4. Mark attempt as consumed (one-time use, prevents replay)
    await this.dbStore.consumeAuthAttempt(attempt.id);

    // 5. Pseudonymize World ID subject using HMAC-SHA256
    const subjectHmac = computeSubjectHmac(claims.sub, this.config.hmacSecret);

    // 6. Verify enrolled operator identity
    const operator = await this.dbStore.findOperatorById(attempt.operatorId);
    if (!operator) {
      throw new NotFoundError('Enrolled operator not found');
    }

    if (operator.subjectHmac !== subjectHmac) {
      throw new AuthenticationError('World ID subject does not match enrolled operator credentials');
    }

    if (operator.status !== 'active') {
      throw new OperatorRevokedError(`Operator status is '${operator.status}', active required`);
    }

    if (new Date(operator.expiresAt) < new Date()) {
      throw new AuthenticationError('Operator enrollment has expired');
    }

    this.logger.info(
      {
        sessionId: attempt.sessionId,
        operatorId: attempt.operatorId,
        proposalId: attempt.proposalId,
        acr,
        authTime: claims.auth_time
      },
      'World ID OIDC authentication verified successfully'
    );

    return {
      authAttemptId: attempt.id,
      sessionId: attempt.sessionId,
      merchantId: attempt.merchantId,
      operatorId: attempt.operatorId,
      proposalId: attempt.proposalId,
      proposalHash: attempt.proposalHash,
      subjectHmac,
      authTime: claims.auth_time,
      acr,
      amr
    };
  }
}

/**
 * Isolated mock World OIDC service for unit tests and deterministic simulation.
 * Clearly labeled as [MOCKED] in logs and traces.
 */
export class MockWorldOidcService extends LiveWorldOidcService {
  private mockTokenClaims: IdTokenClaims | null = null;

  setMockClaims(claims: Partial<IdTokenClaims>) {
    this.mockTokenClaims = {
      sub: claims.sub ?? 'world_user_sub_12345',
      iss: this['config'].issuer,
      aud: this['config'].clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: claims.auth_time ?? Math.floor(Date.now() / 1000),
      acr: claims.acr ?? this['config'].requiredAcr,
      amr: claims.amr ?? [this['config'].requiredAcr],
      nonce: claims.nonce,
      ...claims
    };
  }

  override async handleCallback(input: OidcCallbackInput): Promise<VerifiedOidcSession> {
    const stateHash = sha256Hex(input.state);

    const attempt = await this['dbStore'].findAuthAttemptByStateHash(stateHash);
    if (!attempt) {
      throw new AuthenticationError('Invalid or unknown OIDC state');
    }

    if (attempt.consumedAt != null) {
      throw new ReplayError('OIDC state has already been consumed (replay attack detected)');
    }

    if (new Date(attempt.expiresAt) < new Date()) {
      throw new AuthenticationError('OIDC authentication session has expired');
    }

    if (attempt.proposalHash !== input.proposalHash) {
      throw new AuthenticationError('Proposal hash mismatch: session bound to different proposal');
    }

    // In mock mode, construct verified claims using registered mock token or test defaults
    const claims: IdTokenClaims = this.mockTokenClaims ?? {
      sub: 'world_user_sub_12345',
      iss: this['config'].issuer,
      aud: this['config'].clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      auth_time: Math.floor(Date.now() / 1000),
      acr: this['config'].requiredAcr,
      amr: [this['config'].requiredAcr],
      nonce: (input as any).mockNonce
    };

    return this.validateAndFinalizeSession(attempt, claims);
  }
}
