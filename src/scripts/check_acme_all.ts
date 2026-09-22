import { withTenantDb } from "../db/connection-manager";
import { courses, lessons, quizzes, userProgress, users } from "../db/schema/tenant";

async function main() {
  await withTenantDb("acme", async (db) => {
    const cList = await db.select().from(courses);
    console.log("Courses in acme:", cList);
    const lList = await db.select().from(lessons);
    console.log("Lessons in acme:", lList);
    const qList = await db.select().from(quizzes);
    console.log("Quizzes in acme:", qList);
    const pList = await db.select().from(userProgress);
    console.log("UserProgress in acme:", pList);
    const uList = await db.select().from(users);
    console.log("Users in acme:", uList);
  });
  process.exit(0);
}

main().catch(console.error);
