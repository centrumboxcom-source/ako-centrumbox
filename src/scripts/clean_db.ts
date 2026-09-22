import "dotenv/config";
import { masterPool } from "../db/master";
import { hashPassword } from "../lib/auth/password";

async function cleanDatabase() {
  console.log("=== Starting Database Cleanup ===");

  const defaultAdminPassword = await hashPassword("admin123");
  const defaultStudentPassword = await hashPassword("password123");

  // 1. Clean Acme schema
  console.log("\n1. Cleaning schema 'acme'...");
  await masterPool.query(`
    DELETE FROM "acme".users 
    WHERE email IN (
      'invitee_single@acme.com',
      'team_user_1@acme.com',
      'team_user_2@acme.com',
      'direct_user@acme.com'
    )
  `);

  await masterPool.query(`
    INSERT INTO "acme".users (email, name, password_hash, role, points)
    VALUES ('admin@acme.com', 'Адміністратор Acme', $1, 'admin', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultAdminPassword]);

  await masterPool.query(`
    INSERT INTO "acme".users (email, name, password_hash, role, points)
    VALUES ('student@acme.com', 'Іван Петренко', $1, 'student', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultStudentPassword]);

  // Clean dummy courses (e.g. 'Старт')
  await masterPool.query(`
    DELETE FROM "acme".courses WHERE title = 'Старт'
  `);

  // Clean invitations
  await masterPool.query(`
    DELETE FROM invites WHERE tenant_subdomain = 'acme' AND email LIKE 'team_user_%'
  `);

  // 2. Clean Globex schema
  console.log("\n2. Cleaning schema 'globex'...");
  await masterPool.query(`
    DELETE FROM "globex".users 
    WHERE email IN (
      'admin@globex.org',
      'employee@globex.org',
      'student@globex.org',
      'employee@globex.com'
    )
  `);

  await masterPool.query(`
    INSERT INTO "globex".users (email, name, password_hash, role, points)
    VALUES ('admin@globex.com', 'Адміністратор Globex', $1, 'admin', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultAdminPassword]);

  await masterPool.query(`
    INSERT INTO "globex".users (email, name, password_hash, role, points)
    VALUES ('student@globex.com', 'Студент Globex', $1, 'student', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultStudentPassword]);

  // 3. Clean Nova schema
  console.log("\n3. Cleaning schema 'nova'...");
  await masterPool.query(`
    INSERT INTO "nova".users (email, name, password_hash, role, points)
    VALUES ('admin@nova.com', 'Адміністратор Nova', $1, 'admin', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultAdminPassword]);

  await masterPool.query(`
    INSERT INTO "nova".users (email, name, password_hash, role, points)
    VALUES ('student@nova.com', 'Студент Nova', $1, 'student', 0)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
  `, [defaultStudentPassword]);

  console.log("\n=== Database Cleanup Complete! ===");
  process.exit(0);
}

cleanDatabase().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
