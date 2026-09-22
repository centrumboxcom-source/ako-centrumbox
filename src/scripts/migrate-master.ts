import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { masterPool } from "../db/master";
import { migrateMaster, migrateTenantSchema } from "../lib/migrator";
import { sanitizeSchemaName } from "../db/connection-manager";

async function main() {
  console.log("🚀 Starting database initialization...");
  console.log(`Connecting to: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);

  try {
    // 1. Initialize Master schema
    console.log("📦 Applying Master DB migrations (public.tenants)...");
    await migrateMaster();

    // 2. Provision demo tenants if needed
    const demoTenants = [
      { name: "Acme Learning", subdomain: "acme", adminEmail: "admin@acme.com" },
      { name: "Globex Academy", subdomain: "globex", adminEmail: "admin@globex.org" },
    ];

    for (const t of demoTenants) {
      const safeSub = sanitizeSchemaName(t.subdomain);
      console.log(`🏢 Checking tenant: ${t.name} (${safeSub})...`);

      const client = await masterPool.connect();
      try {
        await client.query("BEGIN;");
        
        // Insert into master
        await client.query(
          `INSERT INTO tenants (name, subdomain, is_active)
           VALUES ($1, $2, true)
           ON CONFLICT (subdomain) DO NOTHING;`,
          [t.name, safeSub]
        );

        // Provision schema
        await migrateTenantSchema(safeSub, client);

        await client.query("COMMIT;");
        console.log(`✅ Tenant '${safeSub}' successfully configured.`);
      } catch (err) {
        await client.query("ROLLBACK;");
        console.error(`❌ Failed to configure tenant '${safeSub}':`, err);
      } finally {
        client.release();
      }
    }

    console.log("🎉 Database initialization completed successfully!");
  } catch (error) {
    console.error("Fatal error during database setup:", error);
    process.exit(1);
  } finally {
    await masterPool.end();
  }
}

main();
