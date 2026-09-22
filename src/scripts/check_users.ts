import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { withTenantDb } from "../db/connection-manager";
import { users } from "../db/schema/tenant";

async function checkUsers() {
  for (const tenant of ["acme", "globex"]) {
    try {
      const tenantUsers = await withTenantDb(tenant, async (db) => {
        return await db.select().from(users);
      });
      console.log(`Tenant '${tenant}' users count:`, tenantUsers.length);
      console.log(`Tenant '${tenant}' users:`, tenantUsers);
    } catch (e) {
      console.error(`Error querying tenant ${tenant}:`, e);
    }
  }
  process.exit(0);
}

checkUsers();
