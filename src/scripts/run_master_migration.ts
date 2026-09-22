import { migrateMaster } from "../lib/migrator";

async function main() {
  console.log("Applying master schema migrations...");
  await migrateMaster();
  console.log("Master schema migrations applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
