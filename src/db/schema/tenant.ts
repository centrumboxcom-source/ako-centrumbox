import { pgTable, uuid, varchar, boolean, timestamp, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type UserRole = "admin" | "instructor" | "student";

export type BlockType = "heading" | "text" | "video" | "code" | "image" | "callout";

export type QuestionType = "single" | "multiple";

export type ActivityType = "lesson" | "quiz";

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface TextBlock {
  id: string;
  type: "text";
  text: string;
}

export interface VideoBlock {
  id: string;
  type: "video";
  url: string;
  caption?: string;
}

export interface CodeBlock {
  id: string;
  type: "code";
  code: string;
  language: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  url: string;
  caption?: string;
}

export interface CalloutBlock {
  id: string;
  type: "callout";
  variant: "info" | "warning" | "tip";
  text: string;
}

export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | VideoBlock
  | CodeBlock
  | ImageBlock
  | CalloutBlock;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("student").notNull().$type<UserRole>(),
  points: integer("points").default(0).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"), // Stores JSON stringified ContentBlock[]
  order: integer("order").default(0).notNull(),
  points: integer("points").default(10).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  passingScore: integer("passing_score").default(70).notNull(), // Percentage e.g. 70
  rewardPoints: integer("reward_points").default(25).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type", { length: 50 })
    .default("single")
    .notNull()
    .$type<QuestionType>(),
  explanation: text("explanation"),
  points: integer("points").default(1).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questionOptions = pgTable("question_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").default(false).notNull(),
  order: integer("order").default(0).notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activityType: varchar("activity_type", { length: 50 })
    .notNull()
    .$type<ActivityType>(), // "lesson" | "quiz"
  title: varchar("title", { length: 255 }), // Snapshot of title
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "set null" }),
  quizId: uuid("quiz_id").references(() => quizzes.id, { onDelete: "set null" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  score: integer("score").default(0).notNull(), // 0 - 100
  passed: boolean("passed").default(true).notNull(),
  pointsAwarded: integer("points_awarded").default(0).notNull(),
  answers: text("answers"), // JSON breakdown
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

// RELATIONS
export const coursesRelations = relations(courses, ({ many }) => ({
  lessons: many(lessons),
  quizzes: many(quizzes),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  quizzes: many(quizzes),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [quizzes.lessonId],
    references: [lessons.id],
  }),
  questions: many(questions),
  progress: many(userProgress),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  options: many(questionOptions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [userProgress.courseId],
    references: [courses.id],
  }),
  quiz: one(quizzes, {
    fields: [userProgress.quizId],
    references: [quizzes.id],
  }),
  lesson: one(lessons, {
    fields: [userProgress.lessonId],
    references: [lessons.id],
  }),
}));

// EXPORT TYPES
export type TenantUser = typeof users.$inferSelect;
export type NewTenantUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
