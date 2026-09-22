import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { masterPool } from "../db/master";

async function check() {
  const client = await masterPool.connect();
  const res = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name IN ('quizzes', 'courses', 'lessons', 'questions', 'question_options', 'user_progress')
    ORDER BY table_schema, table_name;
  `);
  console.log("Existing tables in schemas:", res.rows);

  const fkRes = await client.query(`
    SELECT tc.table_schema, tc.table_name, tc.constraint_name,
           ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'quizzes';
  `);
  console.log("FK constraints for quizzes:", fkRes.rows);

  await masterPool.end();
}
check();
