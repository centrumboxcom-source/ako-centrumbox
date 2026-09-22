import "dotenv/config";
import { masterPool } from "../db/master";

async function inspect() {
  const tenantsRes = await masterPool.query("SELECT * FROM tenants ORDER BY created_at ASC");
  console.log("Registered tenants count:", tenantsRes.rows.length);
  for (const t of tenantsRes.rows) {
    console.log(`\n=== Tenant: ${t.name} (${t.subdomain}) ===`);
    try {
      const usersRes = await masterPool.query(`SELECT id, email, role, name, points FROM "${t.subdomain}".users`);
      console.log(`  Users (${usersRes.rows.length}):`);
      for (const u of usersRes.rows) {
        console.log(`    - [${u.role}] ${u.name} <${u.email}> (${u.points} pts)`);
      }

      const coursesRes = await masterPool.query(`SELECT id, title FROM "${t.subdomain}".courses`);
      console.log(`  Courses (${coursesRes.rows.length}):`);
      for (const c of coursesRes.rows) {
        console.log(`    - ${c.title}`);
      }

      const progressRes = await masterPool.query(`SELECT count(*) FROM "${t.subdomain}".user_progress`);
      console.log(`  Progress entries count: ${progressRes.rows[0].count}`);
    } catch (e: any) {
      console.log(`  Error querying schema ${t.subdomain}:`, e.message);
    }
  }
  process.exit(0);
}

inspect().catch(e => { console.error(e); process.exit(1); });
