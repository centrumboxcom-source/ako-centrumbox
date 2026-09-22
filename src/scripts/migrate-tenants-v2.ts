import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { masterPool } from "../db/master";
import { getAllTenants } from "../lib/services/tenant-service";
import { migrateTenantSchema } from "../lib/migrator";
import { sanitizeSchemaName } from "../db/connection-manager";

async function run() {
  console.log("⚡ Застосування міграцій тестування та прогресу для всіх тенантів...");
  const tenants = await getAllTenants();
  console.log(`Знайдено ${tenants.length} тенантів у Master DB:`, tenants.map(t => t.subdomain));

  for (const t of tenants) {
    const safeSub = sanitizeSchemaName(t.subdomain);
    console.log(`\n📦 Міграція схеми '${safeSub}'...`);
    const res = await migrateTenantSchema(safeSub);
    console.log(`✅ Схему '${safeSub}' оновлено (виконано інструкцій: ${res.statementsExecuted})`);
  }

  console.log("\n🎉 Всі схеми успішно оновлено новими таблицями quizzes, questions, question_options та user_progress!");
  await masterPool.end();
}

run().catch((err) => {
  console.error("Помилка оновлення схем:", err);
  process.exit(1);
});
