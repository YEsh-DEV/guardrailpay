# Repository guidance

- Treat `arkiv/` as integration documentation until an Arkiv SDK adapter is implemented.
- Keep Arkiv records separate from payment settlement, ENS profile resolution, and payout rotation.
- Do not describe mock Hedera receipts, dashboard fixtures, or the current Fastify payment route as production settlement or verification.
- Do not add Arkiv credentials, transaction hashes, deployment claims, or unverified test results to documentation.
- Preserve the existing backend, frontend, and Solidity code while the Arkiv integration remains in design.
