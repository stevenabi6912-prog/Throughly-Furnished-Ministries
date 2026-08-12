CREATE TABLE "enrollment_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"label" text NOT NULL,
	"score" integer NOT NULL,
	"recorded_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_scores" ADD CONSTRAINT "enrollment_scores_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_scores_sort_idx" ON "enrollment_scores" USING btree ("enrollment_id","sort_order");