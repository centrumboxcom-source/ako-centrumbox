import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { withTenantDb } from "../db/connection-manager";
import { courses, lessons, quizzes, questions, questionOptions, userProgress, users } from "../db/schema/tenant";
import { eq } from "drizzle-orm";

async function check() {
  await withTenantDb("acme", async (db) => {
    const c = await db.select().from(courses);
    console.log("Courses:", c.map(x => ({ id: x.id, title: x.title })));
    const q = await db.select().from(quizzes);
    console.log("Quizzes:", q);
    const u = await db.select().from(users);
    console.log("Users:", u.map(x => ({ id: x.id, email: x.email, points: x.points })));
    const p = await db.select().from(userProgress);
    console.log("Progress:", p);
  });
}

check().catch(console.error);
