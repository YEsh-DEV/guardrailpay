import type { FastifyPluginAsync } from 'fastify';
import type { PaymentRequired } from '@x402/core/types';
import { defaultProfile } from '@quoteseal/guard';
import { quoteSealPayeeDeclaration } from '@quoteseal/guard';

export const demoMerchantRoutes: FastifyPluginAsync = async (app) => {
  const TRUSTED_ENS = 'merchant.eth';
  const TRUSTED_PAYTO = defaultProfile.payTo ?? '0.0.123456';
  const ATTACKER_PAYTO = '0.0.9999999';
  const FEE_PAYER = '0.0.98';

  function buildResourceUrl(req: { protocol: string; hostname: string; url: string }): string {
    return `${req.protocol}://${req.hostname}${req.url}`;
  }

  /**
   * Scenario 1: Legitimate Merchant Resource
   * Declares valid QuoteSeal identity and legitimate Hedera payment terms.
   * Returns HTTP 402 on initial request, HTTP 200 on valid payment proof.
   */
  app.get('/demo/merchant/resource', async (req, reply) => {
    const authHeader =
      req.headers['payment-signature'] ||
      req.headers['authorization'] ||
      req.headers['x-payment-proof'];

    if (!authHeader) {
      const challenge: PaymentRequired = {
        x402Version: 2,
        resource: { url: buildResourceUrl(req) },
        accepts: [
          {
            scheme: 'exact',
            network: 'hedera:testnet',
            asset: '0.0.0',
            amount: '10',
            payTo: TRUSTED_PAYTO,
            maxTimeoutSeconds: 60,
            extra: { feePayer: FEE_PAYER }
          }
        ],
        extensions: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
      };

      reply.header('PAYMENT-REQUIRED', JSON.stringify(challenge));
      return reply.status(402).send(challenge);
    }

    return reply.status(200).send({
      status: 'PAID_ACCESS_GRANTED',
      merchant: TRUSTED_ENS,
      message: 'Payment verified by QuoteSeal. Premium resource unlocked.',
      data: {
        reportId: 'rep_legit_2026',
        content: 'Confidential research market intelligence dataset.'
      }
    });
  });

  /**
   * Scenario 2: Unauthorized Recipient (Tampered payTo)
   * Declares trusted identity (merchant.eth) but alters payTo to attacker account.
   */
  app.get('/demo/merchant/resource/tampered-payto', async (req, reply) => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: buildResourceUrl(req) },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: '10',
          payTo: ATTACKER_PAYTO, // Tampered destination
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ],
      extensions: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    };

    reply.header('PAYMENT-REQUIRED', JSON.stringify(challenge));
    return reply.status(402).send(challenge);
  });

  /**
   * Scenario 3: Altered Amount (Excessive Pricing)
   * Declares trusted identity but inflates price beyond authorized cap.
   */
  app.get('/demo/merchant/resource/altered-amount', async (req, reply) => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: buildResourceUrl(req) },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: '999999999', // Exceeds authorized maxAmount (100)
          payTo: TRUSTED_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ],
      extensions: quoteSealPayeeDeclaration({ ens: TRUSTED_ENS })
    };

    reply.header('PAYMENT-REQUIRED', JSON.stringify(challenge));
    return reply.status(402).send(challenge);
  });

  /**
   * Scenario 4: Undeclared Merchant (Case B)
   * Plain HTTP 402 with no QuoteSeal extension.
   */
  app.get('/demo/merchant/resource/undeclared', async (req, reply) => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: buildResourceUrl(req) },
      accepts: [
        {
          scheme: 'exact',
          network: 'hedera:testnet',
          asset: '0.0.0',
          amount: '10',
          payTo: TRUSTED_PAYTO,
          maxTimeoutSeconds: 60,
          extra: { feePayer: FEE_PAYER }
        }
      ]
      // No extensions
    };

    reply.header('PAYMENT-REQUIRED', JSON.stringify(challenge));
    return reply.status(402).send(challenge);
  });
};
