import { createPaymentAttempt, copyData, freezeData, evaluate } from '../../packages/guard/dist/index.js';

// Trusted buyer composition only: never expose this factory or its signer to an LLM.
// Returns a payload, not a settlement claim; transport remains disabled in this spike.
export async function confirmedPayment(input, signer, confirm) {
  const snapshot = { ...input, challenge: copyData(input.challenge) };
  const trust = input.readTrust();
  const requirement = snapshot.challenge.accepts[snapshot.selectedIndex];
  if (evaluate(requirement, snapshot.challenge.accepts, trust.profile, trust.anchors,
    snapshot.originalUrl, snapshot.firstSeen, input.now()) !== 'PASS') {
    throw new Error('QUOTESEAL_REJECTED');
  }
  const attempt = createPaymentAttempt(snapshot, signer);
  const approved = await confirm(freezeData({ url: snapshot.originalUrl, requirement: copyData(requirement) }));
  if (approved !== true) throw new Error('BUYER_CONFIRMATION_REQUIRED');
  return attempt.createPaymentPayload();
}
