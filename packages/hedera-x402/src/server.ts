export interface X402PaymentTerms {
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  ensName?: string;
  serviceEndpoint: string;
  referenceId: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface ProtectedEndpointOptions {
  getPaymentTerms: () => Promise<X402PaymentTerms> | X402PaymentTerms;
  verifyPaymentProof: (proof: string, terms: X402PaymentTerms) => Promise<boolean> | boolean;
}

export function createX402Challenge(terms: X402PaymentTerms) {
  return {
    statusCode: 402,
    headers: {
      'content-type': 'application/json',
      'payment-required': JSON.stringify({
        scheme: 'hedera',
        network: terms.network,
        asset: terms.asset,
        payTo: terms.payTo,
        amount: terms.amount,
        referenceId: terms.referenceId,
        expiresAt: terms.expiresAt,
        ensName: terms.ensName,
      }),
    },
    body: {
      error: 'Payment Required',
      scheme: 'hedera',
      payment: terms,
    },
  };
}
