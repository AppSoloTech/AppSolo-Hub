DROP INDEX "comments_request_created_idx";--> statement-breakpoint
DROP INDEX "comments_request_visibility_created_idx";--> statement-breakpoint
CREATE INDEX "comments_request_created_id_idx" ON "comments" USING btree ("change_request_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comments_request_visibility_created_id_idx" ON "comments" USING btree ("change_request_id","visibility","created_at","id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_length" CHECK (char_length(btrim("comments"."body")) between 1 and 5000);