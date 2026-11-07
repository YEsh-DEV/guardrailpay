# Reach and maintenance

## Target users

- Developers who run autonomous agents that consume x402 payment challenges.
- Merchants who publish ENS payment identity and payout rotation state.
- Operators who need a public, tamper-evident record of risk observations and firewall decisions.

## Accessibility

Expose Arkiv data through stable reason codes, bounded status values, and human-readable timestamps. Do not require users to read raw entity keys or transaction payloads to understand a decision. The dashboard must show when data is unavailable, expired, or not verified.

The current dashboard uses local fixtures. It does not yet read Arkiv or expose live accessibility behavior for Arkiv records.

## Continued development

Keep the SDK adapter behind a small server-side boundary. Add schema-versioned records, owner-filtered queries, expiry renewal, idempotent writes, and metrics for unavailable or stale data before adding dashboard features.

Do not make Arkiv availability a hidden hard dependency for the existing buyer-side guard. Define fail-closed behavior for risk lookups and preserve `UNVERIFIABLE` when required evidence cannot be obtained.
