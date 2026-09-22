import { getAllTenants } from "../lib/services/tenant-service";
import { migrateTenantSchema } from "../lib/migrator";

async function main() {
  console.log("Applying tenant migrations to all active schemas...");
  const tenants = await getAllTenants();

  for (const t of tenants) {
    console.log(`Migrating tenant '${t.subdomain}'...`);
    const result = await migrateTenantSchema(t.subdomain);
    console.log(`✓ Schema '${result.schemaName}' migrated (${result.statementsExecuted} statements).`);
  }

  console.log("All tenant schemas migrated successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
