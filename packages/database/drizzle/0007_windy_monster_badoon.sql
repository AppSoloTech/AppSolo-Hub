CREATE TYPE "public"."work_review_decision" AS ENUM('ACCEPTED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TABLE "work_review_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_request_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"work_summary" text NOT NULL,
	"release_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_review_handoffs_request_version_unique" UNIQUE("change_request_id","version"),
	CONSTRAINT "work_review_handoffs_version_positive" CHECK ("work_review_handoffs"."version" > 0),
	CONSTRAINT "work_review_handoffs_summary_length" CHECK (char_length(btrim("work_review_handoffs"."work_summary")) between 10 and 5000),
	CONSTRAINT "work_review_handoffs_release_notes_length" CHECK ("work_review_handoffs"."release_notes" is null or char_length(btrim("work_review_handoffs"."release_notes")) between 3 and 5000)
);
--> statement-breakpoint
CREATE TABLE "work_review_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handoff_id" uuid NOT NULL,
	"decision" "work_review_decision" NOT NULL,
	"responding_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_review_responses_handoff_unique" UNIQUE("handoff_id"),
	CONSTRAINT "work_review_responses_note_length" CHECK ("work_review_responses"."note" is null or char_length(btrim("work_review_responses"."note")) between 1 and 2000),
	CONSTRAINT "work_review_responses_change_reason_required" CHECK ("work_review_responses"."decision" = 'ACCEPTED' or ("work_review_responses"."note" is not null and char_length(btrim("work_review_responses"."note")) between 3 and 2000))
);
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_duration_positive";--> statement-breakpoint
DROP INDEX "status_history_request_created_idx";--> statement-breakpoint
DROP INDEX "time_entries_request_date_idx";--> statement-breakpoint
DROP INDEX "time_entries_user_date_idx";--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "voided_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_review_handoffs" ADD CONSTRAINT "work_review_handoffs_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_review_handoffs" ADD CONSTRAINT "work_review_handoffs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_review_responses" ADD CONSTRAINT "work_review_responses_handoff_id_work_review_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."work_review_handoffs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_review_responses" ADD CONSTRAINT "work_review_responses_responding_user_id_users_id_fk" FOREIGN KEY ("responding_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_review_handoffs_request_created_id_idx" ON "work_review_handoffs" USING btree ("change_request_id","created_at","id");--> statement-breakpoint
CREATE INDEX "work_review_responses_user_created_id_idx" ON "work_review_responses" USING btree ("responding_user_id","created_at","id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_history_request_created_id_idx" ON "status_history" USING btree ("change_request_id","created_at","id");--> statement-breakpoint
CREATE INDEX "time_entries_request_date_created_id_idx" ON "time_entries" USING btree ("change_request_id","work_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "time_entries_user_date_id_idx" ON "time_entries" USING btree ("user_id","work_date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_note_length" CHECK ("status_history"."note" is null or char_length(btrim("status_history"."note")) between 3 and 2000);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_duration_bounds" CHECK ("time_entries"."duration_minutes" between 1 and 1440);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_description_length" CHECK (char_length(btrim("time_entries"."description")) between 3 and 2000);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_void_all_or_none" CHECK (("time_entries"."voided_by_user_id" is null and "time_entries"."void_reason" is null and "time_entries"."voided_at" is null) or ("time_entries"."voided_by_user_id" is not null and "time_entries"."void_reason" is not null and "time_entries"."voided_at" is not null));--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_void_reason_length" CHECK ("time_entries"."void_reason" is null or char_length(btrim("time_entries"."void_reason")) between 3 and 2000);