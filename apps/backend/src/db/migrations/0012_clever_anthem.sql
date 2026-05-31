ALTER TABLE "users" ADD COLUMN "bonus_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rakeback_claimed_wagered" bigint DEFAULT 0 NOT NULL;