CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"auth_attempt_id" uuid NOT NULL,
	"auth_time" bigint NOT NULL,
	"acr" varchar(64),
	"amr" varchar(64),
	"attestor" varchar(42) NOT NULL,
	"signature_hash" varchar(66) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"decision_id" varchar(128) NOT NULL,
	"proposal_id" uuid,
	"verdict" varchar(32) NOT NULL,
	"reason_code" varchar(64) NOT NULL,
	"chain_id" bigint NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"tx_hash" varchar(66),
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"proposal_hash" varchar(66) NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"nonce_hash" varchar(64) NOT NULL,
	"pkce_verifier_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	CONSTRAINT "auth_attempts_state_hash_unique" UNIQUE("state_hash"),
	CONSTRAINT "auth_attempts_nonce_hash_unique" UNIQUE("nonce_hash")
);
--> statement-breakpoint
CREATE TABLE "merchant_trust" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"buyer_id" varchar(128) NOT NULL,
	"trusted_owner" varchar(42) NOT NULL,
	"trusted_resolver" varchar(42) NOT NULL,
	"trusted_expiry" bigint NOT NULL,
	"trusted_profile_version" integer NOT NULL,
	"trusted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ens_name" varchar(255) NOT NULL,
	"namehash" varchar(66) NOT NULL,
	"endpoint_origin" varchar(255) NOT NULL,
	"chain_id" bigint DEFAULT 11155111 NOT NULL,
	"registry_address" varchar(42) NOT NULL,
	"resolver_address" varchar(42) NOT NULL,
	"owner_address" varchar(42) NOT NULL,
	"name_expiry" bigint NOT NULL,
	"profile_version" integer DEFAULT 1 NOT NULL,
	"network" varchar(64) DEFAULT 'hedera:testnet' NOT NULL,
	"scheme" varchar(32) DEFAULT 'exact' NOT NULL,
	"asset_id" varchar(64) DEFAULT '0.0.0' NOT NULL,
	"active_pay_to" varchar(64) NOT NULL,
	"max_amount" varchar(78) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_ens_name_unique" UNIQUE("ens_name"),
	CONSTRAINT "merchants_namehash_unique" UNIQUE("namehash")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"role" varchar(64) DEFAULT 'ROLE_ROTATION_APPROVER' NOT NULL,
	"issuer" varchar(255) NOT NULL,
	"subject_hmac" varchar(64) NOT NULL,
	"subject_encrypted" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rotation_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"old_pay_to" varchar(64) NOT NULL,
	"new_pay_to" varchar(64) NOT NULL,
	"proposal_hash" varchar(66) NOT NULL,
	"proposal_nonce" bigint NOT NULL,
	"proposed_by" varchar(42) NOT NULL,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"state" varchar(32) DEFAULT 'PROPOSED' NOT NULL,
	"activated_tx" varchar(66),
	"cancelled_at" timestamp with time zone,
	"reason_code" varchar(64),
	CONSTRAINT "rotation_proposals_proposal_hash_unique" UNIQUE("proposal_hash")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_proposal_id_rotation_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."rotation_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_auth_attempt_id_auth_attempts_id_fk" FOREIGN KEY ("auth_attempt_id") REFERENCES "public"."auth_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_proposal_id_rotation_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."rotation_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_attempts" ADD CONSTRAINT "auth_attempts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_attempts" ADD CONSTRAINT "auth_attempts_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_attempts" ADD CONSTRAINT "auth_attempts_proposal_id_rotation_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."rotation_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_trust" ADD CONSTRAINT "merchant_trust_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotation_proposals" ADD CONSTRAINT "rotation_proposals_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_proposal_approval" ON "approvals" USING btree ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_buyer_merchant" ON "merchant_trust" USING btree ("buyer_id","merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_operator_identity" ON "operators" USING btree ("merchant_id","issuer","subject_hmac");