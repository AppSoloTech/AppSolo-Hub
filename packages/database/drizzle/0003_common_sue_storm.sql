ALTER TABLE "organization_invitations" ADD COLUMN "authorized_by_role" "organization_role";--> statement-breakpoint
UPDATE "organization_invitations" AS "invitation"
SET "authorized_by_role" = "membership"."role"
FROM "organization_memberships" AS "membership"
WHERE "membership"."organization_id" = "invitation"."organization_id"
  AND "membership"."user_id" = "invitation"."invited_by_user_id";--> statement-breakpoint
ALTER TABLE "organization_invitations" ALTER COLUMN "authorized_by_role" SET NOT NULL;
