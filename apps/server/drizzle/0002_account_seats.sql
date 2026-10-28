ALTER TABLE "seats" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "seats_user_id" ON "seats" USING btree ("user_id");