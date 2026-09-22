import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { masterPool } from "../db/master";
import { hashPassword } from "../lib/auth/password";
import { migrateMaster, migrateTenantSchema } from "../lib/migrator";
import { sanitizeSchemaName } from "../db/connection-manager";

async function seed() {
  console.log("🌱 Початок наповнення бази даних тестовими користувачами та даними...");
  console.log(`Підключення до: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);

  // 1. Ensure master migrations
  await migrateMaster();

  const tenantsData = [
    {
      name: "Acme Learning",
      subdomain: "acme",
      users: [
        { email: "admin@acme.com", name: "Адміністратор Acme", role: "admin", password: "admin123" },
        { email: "employee@acme.com", name: "Олена Ковальчук", role: "student", password: "password123" },
        { email: "student@acme.com", name: "Іван Петренко", role: "student", password: "password123" },
      ],
    },
    {
      name: "Globex Academy",
      subdomain: "globex",
      users: [
        { email: "admin@globex.org", name: "Адміністратор Globex", role: "admin", password: "admin123" },
        { email: "admin@globex.com", name: "Адміністратор Globex", role: "admin", password: "admin123" },
        { email: "employee@globex.org", name: "Максим Бондар", role: "student", password: "password123" },
        { email: "employee@globex.com", name: "Максим Бондар", role: "student", password: "password123" },
        { email: "student@globex.org", name: "Катерина Шевченко", role: "student", password: "password123" },
      ],
    },
  ];

  const client = await masterPool.connect();

  try {
    for (const t of tenantsData) {
      const safeSub = sanitizeSchemaName(t.subdomain);
      console.log(`\n🏢 Налаштування тенанта '${safeSub}' (${t.name})...`);

      // 1. Ensure tenant in master
      await client.query(
        `INSERT INTO tenants (name, subdomain, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (subdomain) DO UPDATE SET name = $1, is_active = true;`,
        [t.name, safeSub]
      );

      // 2. Ensure schema & tables
      await migrateTenantSchema(safeSub, client);

      // 3. Seed users
      for (const u of t.users) {
        const passwordHash = await hashPassword(u.password);
        await client.query(
          `INSERT INTO "${safeSub}".users (email, name, password_hash, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO UPDATE 
           SET password_hash = $3, role = $4, name = $2;`,
          [u.email.toLowerCase(), u.name, passwordHash, u.role]
        );
        console.log(`  👤 Користувач '${u.email}' [роль: ${u.role}] готовий (пароль: '${u.password}')`);
      }
    }

    console.log("\n🎉 Базу даних успішно наповнено тестовими обліковими записами!");
  } catch (error) {
    console.error("❌ Помилка сіду:", error);
    process.exit(1);
  } finally {
    client.release();
    await masterPool.end();
  }
}

seed();
