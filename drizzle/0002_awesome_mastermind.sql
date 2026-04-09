ALTER TABLE "assignments" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "rubric" jsonb DEFAULT '[]'::jsonb NOT NULL;