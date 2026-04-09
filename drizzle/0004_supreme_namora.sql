CREATE TABLE "grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"criterion_scores" jsonb NOT NULL,
	"overall_feedback" text NOT NULL,
	"total_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"graded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grades_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;