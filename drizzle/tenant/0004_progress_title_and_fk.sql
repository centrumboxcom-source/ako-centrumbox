ALTER TABLE "user_progress" ADD COLUMN IF NOT EXISTS "title" varchar(255);
--> statement-breakpoint
ALTER TABLE "user_progress" ALTER COLUMN "course_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_progress" DROP CONSTRAINT IF EXISTS "user_progress_course_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "user_progress" DROP CONSTRAINT IF EXISTS "user_progress_quiz_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "user_progress" DROP CONSTRAINT IF EXISTS "user_progress_lesson_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;
