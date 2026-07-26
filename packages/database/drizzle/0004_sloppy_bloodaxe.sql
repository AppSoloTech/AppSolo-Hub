CREATE TYPE "public"."estimate_response_decision" AS ENUM('APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED');--> statement-breakpoint
ALTER TYPE "public"."estimate_status" ADD VALUE 'NEEDS_CLARIFICATION' BEFORE 'SUPERSEDED';--> statement-breakpoint
CREATE TABLE "estimate_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"decision" "estimate_response_decision" NOT NULL,
	"responding_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_responses_estimate_unique" UNIQUE("estimate_id"),
	CONSTRAINT "estimate_responses_note_length" CHECK ("estimate_responses"."note" is null or char_length("estimate_responses"."note") <= 2000),
	CONSTRAINT "estimate_responses_reason_required" CHECK ("estimate_responses"."decision" = 'APPROVED' or char_length(btrim("estimate_responses"."note")) between 3 and 2000)
);
--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "estimate_responses" ADD CONSTRAINT "estimate_responses_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_responses" ADD CONSTRAINT "estimate_responses_responding_user_id_users_id_fk" FOREIGN KEY ("responding_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_responses_user_created_idx" ON "estimate_responses" USING btree ("responding_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_one_draft_per_request_unique" ON "estimates" USING btree ("change_request_id") WHERE "estimates"."status" = 'DRAFT';--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_one_submitted_per_request_unique" ON "estimates" USING btree ("change_request_id") WHERE "estimates"."status" = 'SUBMITTED';--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_request_version_unique" UNIQUE("change_request_id","version");--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_version_positive" CHECK ("estimates"."version" > 0);--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_scope_notes_length" CHECK (char_length(btrim("estimates"."scope_notes")) between 10 and 10000);--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_cost_matches_terms" CHECK ("estimates"."estimated_cost" = round("estimates"."estimated_hours" * "estimates"."hourly_rate", 2));