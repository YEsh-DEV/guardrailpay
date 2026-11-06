# QuoteSeal Backend API Contract (v1)

This document specifies the complete REST API contract for the QuoteSeal backend service (`apps/api`), serving as the integration boundary for the frontend web application (`apps/web`) and external automated agent clients.

## Base URL & Protocols

- **Base URL**: `http://localhost:4000` (development) / `https://api.quoteseal.io` (production)
- **Content-Type**: `application/json`
- **Error Format**: Uniform error envelope `{ "error": { "name", "code", "message", "statusCode", "details" } }`

---

## 1. System & Health Endpoints

### 1.1 Liveness Check
Checks whether the Fastify process is responsive.

- **Route**: `GET /health`
- **Auth**: None (Public)
- **Response 200 OK**:
  ```json
  {
    "status": "ok",
    "service": "quoteseal-api",
    "timestamp": "2026-11-06T17:15:00.000Z"
  }
  ```

### 1.2 Readiness Check
Verifies connectivity to critical backend dependencies (PostgreSQL database, Primary Ethereum Sepolia RPC, Secondary Ethereum Sepolia RPC).

- **Route**: `GET /ready`
- **Auth**: None (Public)
- **Response 200 OK**:
  ```json
  {
    "status": "ready",
    "checks": {
      "database": "ok",
      "rpcPrimary": "ok",
      "rpcSecondary": "ok"
    },
    "timestamp": "2026-11-06T17:15:00.000Z"
  }
  ```
- **Response 503 Service Unavailable**:
  ```json
  {
    "status": "unready",
    "checks": {
      "database": "unavailable",
      "rpcPrimary": "ok",
      "rpcSecondary": "ok"
    },
    "timestamp": "2026-11-06T17:15:00.000Z"
  }
  ```

---

## 2. Merchant Profile & Trust Endpoints

### 2.1 Get Merchant Profile (Dual-RPC Resolved)
Resolves the merchant's current on-chain identity records from the dedicated ENSv2 Permissioned Resolver, cross-verified across two independent Sepolia RPC nodes at the identical finalized block.

- **Route**: `GET /v1/merchants/:ensName/profile`
- **Params**:
  - `ensName` (string, 3–255 chars, e.g. `researchpro.eth`)
- **Response 200 OK**:
  ```json
  {
    "data": {
      "profile": {
        "ensName": "researchpro.eth",
        "namehash": "0x4318b5f93f4c593b56003c5fef6b0f6cec15c09c6dd30a9df6fc9cdb0279af5b",
        "owner": "0xa2E0D41Fb8808089b5CD4960a66606cb64903789",
        "resolver": "0x9f2821e752B2784c497f61157F5B9E464C63152d",
        "expiry": 1800000000,
        "profileVersion": 1,
        "activePayTo": "0.0.123456",
        "pendingPayTo": null,
        "rotationStatus": "STABLE",
        "network": "hedera:testnet",
        "scheme": "exact",
        "assetId": "0.0.0",
        "maxAmount": "500000000",
        "finalizedBlockNumber": 12076326,
        "finalizedBlockHash": "0x6198f1a14b308e2f89d38c645ba8903e1986420f1883be12674e0d9b4b041697"
      },
      "resolvedAt": "2026-11-06T17:15:00.000Z"
    }
  }
  ```
- **Response 400 Bad Request**: On malformed ENS name.
- **Response 502 Bad Gateway**: If Dual-RPC verification diverges or fails.

### 2.2 Get Merchant Trust Status
Compares live on-chain profile records against pinned buyer trust anchors.

- **Route**: `GET /v1/merchants/:ensName/trust`
- **Params**:
  - `ensName` (string)
- **Response 200 OK**:
  ```json
  {
    "data": {
      "ensName": "researchpro.eth",
      "trustAnchors": {
        "trustedOwner": "0xa2E0D41Fb8808089b5CD4960a66606cb64903789",
        "trustedResolver": "0x9f2821e752B2784c497f61157F5B9E464C63152d",
        "trustedExpiry": 1800000000,
        "trustedProfileVersion": 1
      },
      "verification": {
        "verdict": "PASS",
        "reasonCode": "OK",
        "message": "Profile records verified against pinned trust anchors"
      },
      "status": "PASS"
    }
  }
  ```
- *Note*: If trust anchors have diverged, `status` will be `HOLD` with a descriptive reason code (e.g. `ANCHOR_RESOLVER_MISMATCH`).

### 2.3 Onboard Merchant (Initiate Onboarding Challenge)
- **Route**: `POST /v1/merchants/onboard`
- **Request Body**:
  ```json
  {
    "ensName": "researchpro.eth",
    "endpointOrigin": "https://api.researchpro.ai",
    "activePayTo": "0.0.123456",
    "maxAmount": "500000000",
    "ownerSignature": "0x..."
  }
  ```
- **Response 202 Accepted**:
  ```json
  {
    "data": {
      "ensName": "researchpro.eth",
      "endpointOrigin": "https://api.researchpro.ai",
      "activePayTo": "0.0.123456",
      "status": "PENDING_ONBOARDING_CHALLENGE",
      "message": "Onboarding request validated and pending contract deployment verification"
    }
  }
  ```

---

## 3. Payout Rotation Endpoints

### 3.1 Get Rotation Status
- **Route**: `GET /v1/merchants/:ensName/rotation-status`
- **Response 200 OK**:
  ```json
  {
    "data": {
      "ensName": "researchpro.eth",
      "activePayTo": "0.0.123456",
      "pendingPayTo": "0.0.789012",
      "rotationStatus": "PROPOSED",
      "profileVersion": 1,
      "blockNumber": 12076326,
      "blockHash": "0x..."
    }
  }
  ```

### 3.2 Get Specific Rotation Proposal
- **Route**: `GET /v1/merchants/:ensName/proposals/:proposalId`
- **Response 200 OK**:
  ```json
  {
    "data": {
      "id": "a0000000-0000-0000-0000-000000000001",
      "ensName": "researchpro.eth",
      "oldPayTo": "0.0.123456",
      "newPayTo": "0.0.789012",
      "state": "PROPOSED",
      "queryTimestamp": "2026-11-06T17:15:00.000Z"
    }
  }
  ```

### 3.3 Submit Rotation Proposal
- **Route**: `POST /v1/merchants/:ensName/proposals`
- **Request Body**:
  ```json
  {
    "newPayTo": "0.0.789012",
    "reasonCode": "OPERATOR_KEY_ROTATION"
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "data": {
      "ensName": "researchpro.eth",
      "oldPayTo": "0.0.123456",
      "newPayTo": "0.0.789012",
      "state": "PROPOSED",
      "reasonCode": "OPERATOR_KEY_ROTATION",
      "message": "Rotation proposal created and awaiting World ID step-up approval"
    }
  }
  ```

### 3.4 Approve Proposal (Submit Attestation Token)
- **Route**: `POST /v1/merchants/:ensName/proposals/:proposalId/approve`
- **Request Body**:
  ```json
  {
    "approvalToken": "att_eyJhbGciOi..."
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "data": {
      "proposalId": "a0000000-0000-0000-0000-000000000001",
      "ensName": "researchpro.eth",
      "approvalStatus": "ACCEPTED",
      "message": "Step-up verification accepted; timelock initiated"
    }
  }
  ```

### 3.5 Cancel Proposal
- **Route**: `POST /v1/merchants/:ensName/proposals/:proposalId/cancel`
- **Request Body**:
  ```json
  {
    "reasonCode": "SECURITY_OPERATOR_ABORT"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "data": {
      "proposalId": "a0000000-0000-0000-0000-000000000001",
      "ensName": "researchpro.eth",
      "status": "CANCELLED",
      "reasonCode": "SECURITY_OPERATOR_ABORT",
      "message": "Proposal successfully cancelled; cannot be activated"
    }
  }
  ```

---

## 4. World ID Authentication (Step-Up Protocol)

### 4.1 Initiate World ID Verification Flow
- **Route**: `POST /v1/world/start`
- **Request Body**:
  ```json
  {
    "proposalId": "a0000000-0000-0000-0000-000000000001"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "data": {
      "proposalId": "a0000000-0000-0000-0000-000000000001",
      "state": "st_a0000000_1762438000",
      "redirectUrl": "https://id.worldcoin.org/authorize?response_type=code&client_id=quoteseal&state=st_a0000000_1762438000"
    }
  }
  ```

### 4.2 World ID Browser Callback
- **Route**: `GET /v1/world/callback?code=...&state=...`
- **Response 200 OK**:
  ```json
  {
    "data": {
      "status": "VERIFIED",
      "message": "World ID OIDC authentication callback received",
      "state": "st_a0000000_1762438000"
    }
  }
  ```

---

## 5. Security & Activity Audit Trail

### 5.1 Query Audit Events
- **Route**: `GET /v1/merchants/:ensName/audit-events?limit=20&verdict=HOLD`
- **Response 200 OK**:
  ```json
  {
    "data": {
      "ensName": "researchpro.eth",
      "total": 1,
      "events": [
        {
          "id": "e0000000-0000-0000-0000-000000000001",
          "merchantId": "m0000000-0000-0000-0000-000000000001",
          "eventType": "PRE_SIGNING_EVALUATION",
          "decisionId": "dec_881829102",
          "verdict": "HOLD",
          "reasonCode": "ANCHOR_RESOLVER_MISMATCH",
          "chainId": 11155111,
          "blockNumber": 12076326,
          "blockHash": "0x6198f1a14b308e2f89d38c645ba8903e1986420f1883be12674e0d9b4b041697",
          "createdAt": "2026-11-06T17:15:00.000Z"
        }
      ]
    }
  }
  ```
