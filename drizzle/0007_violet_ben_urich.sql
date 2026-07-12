ALTER TABLE "grades" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN "revision_count" integer DEFAULT 0 NOT NULL;