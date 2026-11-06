import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { ValidationError } from '@quoteseal/shared';
import type { IDbStore } from './db-store.js';
import type {
  DomainChallengeType,
  MerchantDomainChallengeRecord
} from '@quoteseal/shared';

export interface DomainVerificationOptions {
  dnsResolver?: (domain: string) => Promise<string[][]>;
  fetchFn?: typeof fetch;
  challengeTtlSeconds?: number;
}

export interface VerificationResult {
  verified: boolean;
  message: string;
  challengeId?: string;
  verifiedAt?: Date;
}

export class DomainVerificationService {
  private readonly dnsResolver: (domain: string) => Promise<string[][]>;
  private readonly fetchFn: typeof fetch;
  private readonly challengeTtlSeconds: number;

  constructor(
    private readonly dbStore: IDbStore,
    options: DomainVerificationOptions = {}
  ) {
    this.dnsResolver = options.dnsResolver ?? ((d: string) => dns.resolveTxt(d));
    this.fetchFn = options.fetchFn ?? fetch;
    this.challengeTtlSeconds = options.challengeTtlSeconds ?? 3600; // 1 hour default
  }

  /**
   * Generates a cryptographically secure random token for domain challenge
   */
  generateChallengeToken(): string {
    return `qs_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Normalizes domain name (lowercases, removes leading/trailing dots and protocol)
   */
  normalizeDomain(rawDomain: string): string {
    let domain = rawDomain.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.split('/')[0]!;
    domain = domain.replace(/\.+$/, '');
    if (!domain || domain.includes(' ') || !domain.includes('.')) {
      throw new ValidationError(`Invalid domain name: '${rawDomain}'`);
    }
    return domain;
  }

  /**
   * Initiates a domain ownership challenge and stores it in the database
   */
  async initiateChallenge(
    merchantId: string,
    rawDomain: string,
    challengeType: DomainChallengeType = 'DNS_TXT'
  ): Promise<MerchantDomainChallengeRecord> {
    const domain = this.normalizeDomain(rawDomain);
    const token = this.generateChallengeToken();
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.challengeTtlSeconds * 1000);

    const record: MerchantDomainChallengeRecord = {
      id,
      merchantId,
      domain,
      challengeType,
      token,
      status: 'PENDING',
      createdAt: now,
      expiresAt,
      verifiedAt: null
    };

    await this.dbStore.saveDomainChallenge(record);

    // Also update merchant domain field if present
    await this.dbStore.updateMerchant(merchantId, {
      domain,
      domainChallenge: {
        id,
        challengeType,
        token,
        dnsRecordName: `_quoteseal-challenge.${domain}`,
        dnsRecordValue: `quoteseal-verification=${token}`,
        wellKnownUrl: `https://${domain}/.well-known/quoteseal-challenge.json`
      }
    });

    return record;
  }

  /**
   * Checks DNS TXT records for _quoteseal-challenge.<domain>
   */
  async verifyDnsTxt(domain: string, expectedToken: string): Promise<boolean> {
    const recordName = `_quoteseal-challenge.${domain}`;
    try {
      const records = await this.dnsResolver(recordName);
      for (const group of records) {
        const text = group.join('');
        if (
          text === expectedToken ||
          text === `quoteseal-verification=${expectedToken}` ||
          text.includes(expectedToken)
        ) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Checks HTTPS well-known endpoint https://<domain>/.well-known/quoteseal-challenge.json
   */
  async verifyHttpsWellKnown(domain: string, expectedToken: string): Promise<boolean> {
    const url = `https://${domain}/.well-known/quoteseal-challenge.json`;
    try {
      const res = await this.fetchFn(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return false;
      const data = (await res.json()) as Record<string, unknown>;
      return (
        data.token === expectedToken ||
        data.quotesealChallenge === expectedToken ||
        data.challenge === expectedToken
      );
    } catch {
      return false;
    }
  }

  /**
   * Verifies an active domain challenge for a merchant
   */
  async verifyMerchantDomain(merchantId: string, challengeId?: string): Promise<VerificationResult> {
    let challenge: MerchantDomainChallengeRecord | null = null;
    if (challengeId) {
      challenge = await this.dbStore.findDomainChallengeById(challengeId);
    } else {
      challenge = await this.dbStore.findActiveDomainChallenge(merchantId);
    }

    if (!challenge) {
      return {
        verified: false,
        message: 'No pending domain challenge found for this merchant'
      };
    }

    if (challenge.status === 'VERIFIED') {
      return {
        verified: true,
        message: 'Domain already verified',
        challengeId: challenge.id,
        verifiedAt: challenge.verifiedAt ?? undefined
      };
    }

    if (new Date() > new Date(challenge.expiresAt)) {
      await this.dbStore.updateDomainChallengeStatus(challenge.id, 'EXPIRED');
      return {
        verified: false,
        message: 'Domain challenge has expired; please initiate a new challenge',
        challengeId: challenge.id
      };
    }

    let isMatch = false;
    if (challenge.challengeType === 'DNS_TXT') {
      isMatch = await this.verifyDnsTxt(challenge.domain, challenge.token);
    } else if (challenge.challengeType === 'HTTPS_WELL_KNOWN') {
      isMatch = await this.verifyHttpsWellKnown(challenge.domain, challenge.token);
    }

    if (isMatch) {
      const verifiedAt = new Date();
      await this.dbStore.updateDomainChallengeStatus(challenge.id, 'VERIFIED', verifiedAt);
      await this.dbStore.updateMerchant(merchantId, {
        domainVerifiedAt: verifiedAt,
        status: 'ONBOARDED_UNCOMMITTED'
      });
      return {
        verified: true,
        message: 'Domain successfully verified',
        challengeId: challenge.id,
        verifiedAt
      };
    }

    return {
      verified: false,
      message:
        challenge.challengeType === 'DNS_TXT'
          ? `DNS TXT record '_quoteseal-challenge.${challenge.domain}' with value 'quoteseal-verification=${challenge.token}' not found`
          : `HTTPS endpoint 'https://${challenge.domain}/.well-known/quoteseal-challenge.json' does not return expected token`,
      challengeId: challenge.id
    };
  }
}
