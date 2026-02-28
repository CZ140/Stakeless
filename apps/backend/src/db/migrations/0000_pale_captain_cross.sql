CREATE TABLE IF NOT EXISTS "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_user_id" integer,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_bonus_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"amount" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"bet_amount" bigint NOT NULL,
	"outcome" varchar(50) NOT NULL,
	"profit" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"state" text NOT NULL,
	"bet_amount" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"total_wagered" bigint DEFAULT 0 NOT NULL,
	"total_profit" bigint DEFAULT 0 NOT NULL,
	"total_loss" bigint DEFAULT 0 NOT NULL,
	"role" varchar(20) DEFAULT 'player' NOT NULL,
	"last_bonus_claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"token_version" integer DEFAULT 0 NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_bonus_claims" ADD CONSTRAINT "daily_bonus_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
