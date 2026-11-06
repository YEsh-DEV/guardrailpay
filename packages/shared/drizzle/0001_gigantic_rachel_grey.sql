ALTER TABLE "approvals" ADD COLUMN "signature" text NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "attestation_expiry" bigint;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "controller_address" varchar(42);