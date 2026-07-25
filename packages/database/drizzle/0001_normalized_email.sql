ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));
