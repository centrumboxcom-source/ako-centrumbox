import "dotenv/config";
import { masterPool } from "../db/master";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || "admin@centrumbox.com").trim().toLowerCase();
  const password = args[1] || "SuperAdmin2026!";
  const name = args[2] || "Головний Адміністратор CENTRUMBOX";

  console.log("=== Створення облікового запису Супер-Адміністратора ===");
  console.log(`Email: ${email}`);
  console.log(`Ім'я: ${name}`);

  // Ensure table exists in master schema
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS "platform_admins" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "email" varchar(255) NOT NULL,
      "name" varchar(255) NOT NULL,
      "password_hash" varchar(255) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
    );
  `);

  const passwordHash = await hashPassword(password);

  const res = await masterPool.query(
    `INSERT INTO "platform_admins" (email, name, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         updated_at = NOW()
     RETURNING id, email, name, created_at;`,
    [email, name, passwordHash]
  );

  console.log("\n✅ Супер-Адміністратора успішно збережено в базі даних!");
  console.log(res.rows[0]);
  console.log(`\n👉 Тепер ви можете увійти на сторінці /login:`);
  console.log(`   Email:  ${email}`);
  console.log(`   Пароль: ${password}`);
  console.log(`   Маршрут: /superadmin (автоматичний редирект)`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Помилка створення суперадміна:", err);
  process.exit(1);
});
