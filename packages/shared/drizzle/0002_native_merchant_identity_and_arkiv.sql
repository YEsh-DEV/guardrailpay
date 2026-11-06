ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "identity_type" varchar(32) DEFAULT 'ENSV2' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "identity_ref" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "ens_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "namehash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "registry_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "resolver_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "name_expiry" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "domain" varchar(255);--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "domain_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "domain_challenge" jsonb;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchant_domain_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"challenge_type" varchar(32) NOT NULL,
	"token" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_nonces" (
	"nonce" varchar(128) PRIMARY KEY NOT NULL,
	"merchant_id" varchar(128),
	"wallet_address" varchar(42) NOT NULL,
	"endpoint_origin" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchant_payout_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"pay_to" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"label" varchar(128),
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arkiv_sync_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"entity_key" varchar(66) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tx_hash" varchar(66),
	"payload_json" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'CONFIRMED' NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchant_domain_challenges" ADD CONSTRAINT "merchant_domain_challenges_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "merchant_payout_wallets" ADD CONSTRAINT "merchant_payout_wallets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arkiv_sync_records" ADD CONSTRAINT "arkiv_sync_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
