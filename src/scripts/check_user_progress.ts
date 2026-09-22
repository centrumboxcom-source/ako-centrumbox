import { withTenantDb } from "../db/connection-manager";
import { users, userProgress, quizzes, lessons } from "../db/schema/tenant";

async function main() {
  console.log("=== ПЕРЕВІРКА КОРИСТУВАЧІВ ТА ПРОГРЕСУ В ACME ===");

  await withTenantDb("acme", async (db) => {
    const allUsers = await db.select().from(users);
    console.log(`\nВсього користувачів: ${allUsers.length}`);
    for (const u of allUsers) {
      console.log(`- ${u.name} (${u.email}): role=${u.role}, points=${u.points}, id=${u.id}`);
    }

    const allProgress = await db.select().from(userProgress);
    console.log(`\nВсього записів у user_progress: ${allProgress.length}`);
    for (const p of allProgress) {
      console.log(`- User: ${p.userId}, Type: ${p.activityType}, Course: ${p.courseId}, Lesson: ${p.lessonId}, Quiz: ${p.quizId}, Score: ${p.score}, Passed: ${p.passed}, PointsAwarded: ${p.pointsAwarded}, Date: ${p.completedAt}`);
    }

    const allQuizzes = await db.select().from(quizzes);
    console.log(`\nВсього тестів: ${allQuizzes.length}`);
    for (const q of allQuizzes) {
      console.log(`- Quiz ${q.id}: "${q.title}", courseId=${q.courseId}, rewardPoints=${q.rewardPoints}`);
    }
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
