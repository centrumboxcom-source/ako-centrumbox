import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { masterPool } from "../db/master";
import { getAllTenants } from "../lib/services/tenant-service";
import { migrateTenantSchema } from "../lib/migrator";
import { sanitizeSchemaName } from "../db/connection-manager";

async function fix() {
  const client = await masterPool.connect();
  console.log("1. Cleaning up erroneous tables from public schema...");
  await client.query(`
    DROP TABLE IF EXISTS "public"."user_progress" CASCADE;
    DROP TABLE IF EXISTS "public"."question_options" CASCADE;
    DROP TABLE IF EXISTS "public"."questions" CASCADE;
    DROP TABLE IF EXISTS "public"."quizzes" CASCADE;
  `);
  console.log("Cleaned up public schema.");
  client.release();

  console.log("\n2. Re-applying tenant migrations with explicit schema FKs...");
  const tenants = await getAllTenants();
  for (const t of tenants) {
    const safeSub = sanitizeSchemaName(t.subdomain);
    console.log(`Migrating tenant '${safeSub}'...`);
    const res = await migrateTenantSchema(safeSub);
    console.log(`Tenant '${safeSub}' migrated:`, res);
  }

  // Verify constraints
  const verifyClient = await masterPool.connect();
  const res = await verifyClient.query(`
    SELECT tc.table_schema, tc.table_name, kcu.column_name, 
           ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'quizzes';
  `);
  console.log("\nQuizzes FK constraints after fix:", res.rows);
  verifyClient.release();

  await masterPool.end();
}

fix().catch(console.error);
