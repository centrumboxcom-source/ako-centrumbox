import "dotenv/config";
import { masterPool } from "../db/master";

async function wipeDatabase() {
  console.log("=================================================");
  console.log("⚠️  ПОЧАТОК ПОВНОГО ОЧИЩЕННЯ БАЗИ ДАНИХ NEON  ⚠️");
  console.log("=================================================");

  const client = await masterPool.connect();

  try {
    // 1. Отримуємо список усіх схем, які не є системними
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN (
        'information_schema', 
        'pg_catalog', 
        'pg_toast', 
        'public', 
        'neon_auth'
      )
      AND schema_name NOT LIKE 'pg_%';
    `);

    const schemasToDrop = schemasRes.rows.map((r) => r.schema_name);
    console.log(`\n1. Знайдено клієнтських схем для видалення: ${schemasToDrop.length}`);

    for (const schema of schemasToDrop) {
      console.log(`   - Видалення схеми "${schema}" (DROP SCHEMA CASCADE)...`);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
    }

    // Також явно перевіряємо тестові назви acme, globex, nova
    for (const defaultSchema of ["acme", "globex", "nova"]) {
      await client.query(`DROP SCHEMA IF EXISTS "${defaultSchema}" CASCADE;`);
    }

    // 2. Очищуємо master-таблиці
    console.log("\n2. Очищення master-таблиць у схемі 'public'...");
    
    // Перевіряємо наявність invites
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invites') THEN
          TRUNCATE TABLE invites CASCADE;
        END IF;
      END $$;
    `);

    // Перевіряємо наявність tenants
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
          TRUNCATE TABLE tenants CASCADE;
        END IF;
      END $$;
    `);

    // 3. Гарантуємо наявність структури master-таблиць
    console.log("\n3. Створення/перевірка структури master-таблиць...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(255) NOT NULL,
        "subdomain" varchar(63) NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
      );

      CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "tenant_subdomain" varchar(63) NOT NULL,
        "email" varchar(255),
        "role" varchar(50) DEFAULT 'student' NOT NULL,
        "token" varchar(128) NOT NULL,
        "max_uses" integer DEFAULT 1 NOT NULL,
        "uses_count" integer DEFAULT 0 NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "used_at" timestamp with time zone,
        "created_by_id" uuid,
        "created_by_name" varchar(255),
        "is_revoked" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "invites_token_unique" UNIQUE("token")
      );

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

    // 4. Перевірка результату
    const countTenants = await client.query(`SELECT count(*)::int as count FROM tenants;`);
    const countAdmins = await client.query(`SELECT count(*)::int as count FROM platform_admins;`);

    console.log("\n=================================================");
    console.log("🎉 ОЧИЩЕННЯ УСПІШНО ЗАВЕРШЕНО!");
    console.log(`- Кількість компаній у базі: ${countTenants.rows[0].count}`);
    console.log(`- Кількість суперадміністраторів: ${countAdmins.rows[0].count}`);
    console.log("=================================================");
  } finally {
    client.release();
  }

  process.exit(0);
}

wipeDatabase().catch((err) => {
  console.error("❌ Помилка очищення бази:", err);
  process.exit(1);
});
