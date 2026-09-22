import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { masterPool } from "../db/master";

async function inspectFk() {
  const client = await masterPool.connect();
  const res = await client.query(`
    SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name, 
           rc.delete_rule,
           ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_name = 'user_progress';
  `);
  console.log("user_progress FKs:", res.rows);
  client.release();
  await masterPool.end();
}

inspectFk().catch(console.error);
