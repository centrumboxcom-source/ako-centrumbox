import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { withTenantDb } from "../db/connection-manager";
import { courses, lessons, quizzes, questions, questionOptions, userProgress, users } from "../db/schema/tenant";
import { eq, and } from "drizzle-orm";

async function fixData() {
  console.log("=== Fixing Acme Tenant Quiz & User Progress Data ===");

  await withTenantDb("acme", async (db) => {
    // 1. Get Course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.title, "Основи веб-розробки та безпеки 2026"))
      .limit(1);

    if (!course) {
      throw new Error("Course 'Основи веб-розробки та безпеки 2026' not found!");
    }
    console.log("Course found:", course.id, course.title);

    // 2. Ensure Quiz exists
    let [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, course.id))
      .limit(1);

    if (!quiz) {
      console.log("Creating quiz for course...");
      [quiz] = await db
        .insert(quizzes)
        .values({
          courseId: course.id,
          title: "Контрольний тест: Архітектура Multi-tenant",
          description: "Тест для перевірки знань концепції schema-per-tenant та безпеки з'єднань.",
          passingScore: 70,
          rewardPoints: 30,
        })
        .returning();

      console.log("Created quiz:", quiz.id, quiz.title);

      // Create Questions & Options
      const [q1] = await db
        .insert(questions)
        .values({
          quizId: quiz.id,
          questionText: "Яка команда використовується для ізоляції пошуку схеми в межах транзакції PostgreSQL?",
          questionType: "single",
          points: 1,
          order: 1,
          explanation: "SET LOCAL діє виключно в межах поточної транзакції та запобігає витокам з'єднань.",
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionId: q1.id, optionText: 'SET LOCAL search_path TO "tenant", public;', isCorrect: true, order: 1 },
        { questionId: q1.id, optionText: "DROP DATABASE multitenant;", isCorrect: false, order: 2 },
        { questionId: q1.id, optionText: "ALTER USER postgres WITH SUPERUSER;", isCorrect: false, order: 3 },
      ]);

      const [q2] = await db
        .insert(questions)
        .values({
          quizId: quiz.id,
          questionText: "Які переваги надає підхід Schema-per-Tenant в PostgreSQL?",
          questionType: "multiple",
          points: 2,
          order: 2,
          explanation: "Підхід schema-per-tenant гарантує логічну ізоляцію та швидкі бекапи окремих клієнтів.",
        })
        .returning();

      await db.insert(questionOptions).values([
        { questionId: q2.id, optionText: "Повна ізоляція даних між організаціями", isCorrect: true, order: 1 },
        { questionId: q2.id, optionText: "Можливість індивідуальних міграцій схем", isCorrect: true, order: 2 },
        { questionId: q2.id, optionText: "Неможливість використання загального пулу з'єднань", isCorrect: false, order: 3 },
      ]);

      console.log("Questions & options seeded successfully.");
    } else {
      console.log("Existing quiz found:", quiz.id, quiz.title);
    }

    // 3. Update existing lesson progress titles for all users
    const allLessons = await db.select().from(lessons);
    const lessonMap = new Map(allLessons.map((l) => [l.id, l.title]));

    const existingProgress = await db.select().from(userProgress);
    for (const p of existingProgress) {
      if (p.activityType === "lesson" && p.lessonId && !p.title) {
        const title = lessonMap.get(p.lessonId) ? `Урок: ${lessonMap.get(p.lessonId)}` : "Урок курсу";
        await db.update(userProgress).set({ title }).where(eq(userProgress.id, p.id));
        console.log(`Updated title for progress ${p.id} -> "${title}"`);
      }
    }

    // 4. Ensure admin@acme.com has quiz progress (+30 points)
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@acme.com"))
      .limit(1);

    if (adminUser) {
      console.log("Admin user:", adminUser.email, "Points:", adminUser.points);

      const [adminQuizProgress] = await db
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, adminUser.id),
            eq(userProgress.activityType, "quiz")
          )
        )
        .limit(1);

      if (!adminQuizProgress) {
        console.log("Inserting missing quiz progress for admin@acme.com (+30 points)...");
        await db.insert(userProgress).values({
          userId: adminUser.id,
          activityType: "quiz",
          title: `Тест: ${quiz.title}`,
          courseId: course.id,
          quizId: quiz.id,
          score: 100,
          passed: true,
          pointsAwarded: 30,
          completedAt: new Date(),
        });
        console.log("Inserted quiz progress for admin.");
      } else {
        console.log("Admin quiz progress already exists:", adminQuizProgress.id);
      }

      // Ensure points balance is 50
      await db.update(users).set({ points: 50 }).where(eq(users.id, adminUser.id));
    }

    // 5. Also ensure student@acme.com has quiz progress (+30 points) to match their 40 points
    const [studentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "student@acme.com"))
      .limit(1);

    if (studentUser) {
      const [studentQuizProgress] = await db
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, studentUser.id),
            eq(userProgress.activityType, "quiz")
          )
        )
        .limit(1);

      if (!studentQuizProgress) {
        console.log("Inserting missing quiz progress for student@acme.com (+30 points)...");
        await db.insert(userProgress).values({
          userId: studentUser.id,
          activityType: "quiz",
          title: `Тест: ${quiz.title}`,
          courseId: course.id,
          quizId: quiz.id,
          score: 100,
          passed: true,
          pointsAwarded: 30,
          completedAt: new Date(),
        });
        console.log("Inserted quiz progress for student.");
      }
    }

    console.log("Data fix complete!");
  });
}

fixData().catch((err) => {
  console.error("Fix data failed:", err);
  process.exit(1);
});
