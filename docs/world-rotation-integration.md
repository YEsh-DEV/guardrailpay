# QuoteSeal: World ID OIDC & Payout Rotation Integration Guide

## 1. Architecture Overview & Boundaries

QuoteSeal enforces multi-party governance over merchant payout address rotations through a hybrid cryptographic architecture:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MERCHANT CLIENT                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │                                 ▲                                 │
          │ 1. Enroll Operator              │ 3. Authenticate with Orb        │ 5. Execute On-Chain
          │    (Merchant EIP-712)           │    (OIDC Code + PKCE)           │    (Operator Tx)
          ▼                                 ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│  QuoteSeal API   │              │ World ID Auth    │              │ RotationController│
│  (Fastify/Node24)│              │ (auth.world.org) │              │ (Solidity/Sepolia)│
└──────────────────┘              └──────────────────┘              └──────────────────┘
          │                                                                   ▲
          │ 4. Issue Attestation (Attestor EIP-712 Signature)                 │
          └───────────────────────────────────────────────────────────────────┘
```

### Critical Architectural Boundary:
- **The Smart Contract (`RotationController.sol`) DOES NOT verify World ID OIDC tokens.** Smart contracts cannot parse Web PKI X.509 signatures or execute OpenID Connect authorization code token exchanges on-chain.
- **The Backend Attestor Service** acts as an authorized EIP-712 oracle. It executes the full OIDC exchange with the official World ID issuer (`https://auth.world.org`), validates cryptographic ID token signatures, enforces biometric verification levels (`orb`), checks authentication freshness (`auth_time`), and pseudonymizes user subjects using HMAC-SHA256.
- Once step-up verification succeeds, the attestor signs a typed EIP-712 `RotationApproval` struct using a dedicated private key recognized by `RotationController.sol`.
- The operator then submits this attestation directly to `RotationController.approveWithAttestation()`.
- On-chain state in `RotationController` is the **single source of truth** for all rotation proposals, delay enforcement, and activation. The backend database serves as an index and verification coordinator.

---

## 2. World ID Developer Portal Configuration

To configure World ID OIDC for QuoteSeal, set up an application in the [World ID Developer Portal](https://developer.worldcoin.org):

| Parameter | Recommended Setting | Description |
| :--- | :--- | :--- |
| **Application Type** | Sign in with World (OIDC) | Standard OpenID Connect Relying Party |
| **App ID / Client ID** | `app_...` | Set in backend as `WORLD_ID_CLIENT_ID` |
| **Issuer URL** | `https://auth.world.org` | Official OpenID Connect discovery endpoint |
| **Redirect URIs** | `http://localhost:4000/v1/world/callback` (dev)<br>`https://api.quoteseal.io/v1/world/callback` (prod) | Exact matching callback URI |
| **Verification Level (ACR)** | `orb` | Strict policy requiring biometric in-person Orb verification |
| **Flow** | Authorization Code with PKCE | Code challenge method `S256` |
| **Freshness Policy** | `max_age=0` | Forces prompt and re-authentication on every rotation attempt |

---

## 3. Cryptographic EIP-712 Schemas

Both merchant operator enrollment and rotation attestations use EIP-712 structured data signing.

### 3.1 Domain Separator
```json
{
  "name": "QuoteSeal Rotation Controller",
  "version": "1",
  "chainId": 11155111,
  "verifyingContract": "0x..."
}
```

### 3.2 Operator Enrollment Typed Data
Signed by the **Merchant Owner** (owner of the merchant's ENS node / resolver) to authorize an operator wallet:
```json
{
  "types": {
    "EIP712Domain": [
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "OperatorEnrollment": [
      { "name": "merchantId", "type": "bytes32" },
      { "name": "operator", "type": "address" },
      { "name": "role", "type": "uint256" },
      { "name": "expiry", "type": "uint256" },
      { "name": "nonce", "type": "uint256" },
      { "name": "controller", "type": "address" }
    ]
  }
}
```

### 3.3 Rotation Approval Typed Data
Signed by the **Backend Attestor Service** after biometric World ID step-up:
```json
{
  "types": {
    "EIP712Domain": [
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "RotationApproval": [
      { "name": "merchantId", "type": "bytes32" },
      { "name": "proposalId", "type": "bytes32" },
      { "name": "operator", "type": "address" },
      { "name": "resolver", "type": "address" },
      { "name": "namehash", "type": "bytes32" },
      { "name": "oldPayToHash", "type": "bytes32" },
      { "name": "newPayToHash", "type": "bytes32" },
      { "name": "effectiveAt", "type": "uint64" },
      { "name": "proposalExpiry", "type": "uint64" },
      { "name": "proposalNonce", "type": "uint256" },
      { "name": "authTime", "type": "uint64" },
      { "name": "attestationExpiry", "type": "uint64" }
    ]
  }
}
```

---

## 4. Frontend & Client API Specifications

### 4.1 Operator Enrollment
Allows the merchant owner to enroll an operator with their pseudonymized World ID identity.

- **Route:** `POST /v1/merchants/:ensName/operators`
- **Request Body:**
  ```json
  {
    "walletAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "rawSubjectOrHmac": "world_user_sub_98765",
    "ownerSignature": "0x...",
    "expiryTimestamp": 1772841600,
    "role": "ROLE_ROTATION_APPROVER"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "operatorId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "merchantId": "0x56a4270b... (bytes32)",
    "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "subjectHmac": "6f89b...",
    "status": "active",
    "enrolledAt": "2026-11-06T12:00:00.000Z",
    "expiresAt": "2026-12-06T12:00:00.000Z"
  }
  ```

### 4.2 Propose Payout Address Rotation
Initiated by an active enrolled operator to rotate the ENS `quoteseal.payto` address.

- **Route:** `POST /v1/merchants/:ensName/proposals`
- **Request Body:**
  ```json
  {
    "operatorAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "proposedPayTo": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "reasonCode": "SECURITY_ROTATION"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "proposalId": "feca51ba-57f8-440c-8f36-99528976af93",
    "proposalHash": "0xa1b2c3...",
    "merchantId": "0x56a4270b...",
    "currentPayTo": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "proposedPayTo": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "status": "PROPOSED",
    "requiresStepUp": true,
    "stepUpType": "WORLD_ID_OIDC"
  }
  ```

### 4.3 Initiate World ID OIDC Step-Up
Binds a fresh authorization code session to the exact `proposalHash`.

- **Route:** `POST /v1/world/start`
- **Request Body:**
  ```json
  {
    "merchantId": "0x56a4270b...",
    "operatorId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "proposalId": "feca51ba-57f8-440c-8f36-99528976af93",
    "proposalHash": "0xa1b2c3..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sessionId": "a98fd2b8-...",
    "authorizationUrl": "https://auth.world.org/oauth/authorize?response_type=code&client_id=...&code_challenge=...&max_age=0&state=...",
    "proposalHash": "0xa1b2c3...",
    "expiresAt": "2026-11-06T12:05:00.000Z"
  }
  ```
- The frontend redirects the user or opens the World ID mobile app / QR code flow using `authorizationUrl`.

### 4.4 Finalize Step-Up (OIDC Callback)
Exchanges the authorization code for tokens, verifies claims, checks freshness, and pseudonymizes the subject.

- **Route:** `POST /v1/world/callback`
- **Request Body:**
  ```json
  {
    "code": "auth_code_from_world",
    "state": "state_returned_by_world",
    "proposalHash": "0xa1b2c3..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "verified": true,
    "sessionId": "a98fd2b8-...",
    "proposalHash": "0xa1b2c3...",
    "authTime": 1772840100,
    "acr": "orb"
  }
  ```

### 4.5 Request Attestation & Submit Approval
Requests the backend attestor EIP-712 signature and submits the approval transaction on-chain.

- **Route:** `POST /v1/merchants/:ensName/proposals/:proposalId/approve`
- **Request Body:**
  ```json
  {
    "operatorAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "sessionId": "a98fd2b8-..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "proposalId": "feca51ba-57f8-440c-8f36-99528976af93",
    "status": "APPROVED",
    "txHash": "0x5e8b...",
    "unlockTime": 1772926500,
    "attestation": {
      "attestorAddress": "0x1234...",
      "signature": "0x...",
      "expiry": 1772840400
    }
  }
  ```

### 4.6 Activate Rotation (After Timelock)
Executes `RotationController.activateRotation()` to update the ENS text record to the new payout address.

- **Route:** `POST /v1/merchants/:ensName/proposals/:proposalId/activate`
- **Response (200 OK):**
  ```json
  {
    "proposalId": "feca51ba-57f8-440c-8f36-99528976af93",
    "status": "EXECUTED",
    "txHash": "0x892a...",
    "newActivePayTo": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  }
  ```

### 4.7 Emergency Cancellation
Cancels a pending proposal in case of compromised operator credentials or dispute.

- **Route:** `POST /v1/merchants/:ensName/proposals/:proposalId/cancel`
- **Request Body:**
  ```json
  {
    "callerAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "reason": "Compromised operator key"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "proposalId": "feca51ba-57f8-440c-8f36-99528976af93",
    "status": "CANCELLED",
    "txHash": "0x2bc4..."
  }
  ```

---

## 5. Security Protections & Defense in Depth

1. **Replay & Session Hijacking Protection**:
   - `state` and `nonce` parameters are generated using cryptographically secure random bytes (CSPRNG).
   - Only their SHA-256 hashes are persisted in the database.
   - The database enforces atomic one-time consumption (`consumedAt = now()`) on callback handling. Any reused state triggers immediate rejection with `409 REPLAY_DETECTED`.

2. **At-Rest PKCE Protection**:
   - PKCE `code_verifier` strings are never stored in plaintext.
   - They are encrypted using **AES-256-GCM** with authenticated associated data (AEAD) before database persistence.

3. **Freshness & Assurance Levels**:
   - The OIDC request forces re-authentication using `max_age=0`.
   - The backend enforces `auth_time` freshness within a strict window (default: 120 seconds). Stale authentication attempts are rejected.
   - The OIDC ID token claim `acr` must equal `orb` (Orb biometric verification level). Device-only credentials are unconditionally rejected.

4. **Zero Knowledge / Subject Pseudonymization**:
   - Raw World ID subjects (`sub`) and raw biometric representations are **never** stored in the database.
   - The backend derives a deterministic HMAC-SHA256 hash using `OPERATOR_SUBJECT_HMAC_SECRET`:
     $$\text{subjectHmac} = \text{HMAC-SHA256}(K, \text{sub})$$
   - Only `subjectHmac` is stored and indexed.

5. **Authoritative On-Chain Truth**:
   - If there is any discrepancy between the database cache and `RotationController.sol`, the on-chain contract state strictly overrides the database.
