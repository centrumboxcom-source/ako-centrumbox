import fs from "fs";
import path from "path";
import { PoolClient } from "pg";
import { masterPool } from "@/db/master";
import { sanitizeSchemaName } from "@/db/connection-manager";

/**
 * Applies the Master / Public schema migrations.
 * Ensures the `tenants` table exists.
 */
export async function migrateMaster(): Promise<void> {
  const masterDir = path.join(process.cwd(), "drizzle", "master");
  const client = await masterPool.connect();

  try {
    if (!fs.existsSync(masterDir)) {
      console.warn("Master migrations folder not found at:", masterDir);
      return;
    }

    const files = fs
      .readdirSync(masterDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = path.join(masterDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await client.query(statement);
      }
    }
    console.log("Master schema migrations applied successfully.");
  } finally {
    client.release();
  }
}

/**
 * Programmatically provisions and migrates an isolated tenant schema.
 * 1. Executes CREATE SCHEMA IF NOT EXISTS "safe_subdomain"
 * 2. Sets search_path to the new schema
 * 3. Applies all tenant SQL migration files into that schema
 */
export async function migrateTenantSchema(
  subdomain: string,
  existingClient?: PoolClient
): Promise<{ success: boolean; schemaName: string; statementsExecuted: number }> {
  const safeSchema = sanitizeSchemaName(subdomain);
  const client = existingClient || (await masterPool.connect());
  const shouldRelease = !existingClient;

  try {
    // 1. Create schema if it doesn't already exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchema}";`);

    // 2. Set search_path for this connection
    await client.query(`SET search_path TO "${safeSchema}", public;`);

    // 3. Load migration files from drizzle/tenant
    const tenantDir = path.join(process.cwd(), "drizzle", "tenant");
    let statementsExecuted = 0;

    if (fs.existsSync(tenantDir)) {
      const files = fs
        .readdirSync(tenantDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        const filePath = path.join(tenantDir, file);
        let sqlContent = fs.readFileSync(filePath, "utf-8");

        // Adapt foreign keys referencing "public".tableName to current tenant schema
        sqlContent = sqlContent.replace(/"public"\./g, `"${safeSchema}".`);

        const statements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          try {
            await client.query(stmt);
            statementsExecuted++;
          } catch (stmtErr: any) {
            // Ignore idempotent errors:
            // 42701: duplicate_column (column already exists)
            // 42P07: duplicate_table (table already exists)
            // 42710: duplicate_object (constraint/type/index already exists)
            if (
              stmtErr.code === "42701" ||
              stmtErr.code === "42P07" ||
              stmtErr.code === "42710"
            ) {
              continue;
            }
            throw stmtErr;
          }
        }
      }
    } else {
      // Fallback DDL if migration files are absent
      await client.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "email" varchar(255) NOT NULL UNIQUE,
          "name" varchar(255) NOT NULL,
          "password_hash" varchar(255) NOT NULL,
          "role" varchar(50) DEFAULT 'student' NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "courses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "title" varchar(255) NOT NULL,
          "description" text,
          "is_published" boolean DEFAULT false NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "lessons" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
          "title" varchar(255) NOT NULL,
          "content" text,
          "order" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);
      statementsExecuted += 3;
    }

    return {
      success: true,
      schemaName: safeSchema,
      statementsExecuted,
    };
  } finally {
    try {
      await client.query("RESET search_path;");
    } catch {
      // ignore
    }
    if (shouldRelease) {
      client.release();
    }
  }
}
