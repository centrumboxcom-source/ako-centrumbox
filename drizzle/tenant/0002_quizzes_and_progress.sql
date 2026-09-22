ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE CASCADE,
	"lesson_id" uuid REFERENCES "public"."lessons"("id") ON DELETE SET NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"reward_points" integer DEFAULT 25 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL REFERENCES "public"."quizzes"("id") ON DELETE CASCADE,
	"question_text" text NOT NULL,
	"question_type" varchar(50) DEFAULT 'single' NOT NULL,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL REFERENCES "public"."questions"("id") ON DELETE CASCADE,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
	"activity_type" varchar(50) NOT NULL,
	"course_id" uuid NOT NULL REFERENCES "public"."courses"("id") ON DELETE CASCADE,
	"quiz_id" uuid REFERENCES "public"."quizzes"("id") ON DELETE CASCADE,
	"lesson_id" uuid REFERENCES "public"."lessons"("id") ON DELETE CASCADE,
	"score" integer DEFAULT 0 NOT NULL,
	"passed" boolean DEFAULT true NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"answers" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
