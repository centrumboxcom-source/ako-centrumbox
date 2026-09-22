import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as masterSchema from "./schema/master";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/multitenant_lms";

const isSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech") ||
  connectionString.includes("supabase.co");

declare global {
  // eslint-disable-next-line no-var
  var __masterPool: Pool | undefined;
}

export const masterPool =
  globalThis.__masterPool ??
  new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__masterPool = masterPool;
}

export const masterDb = drizzle(masterPool, { schema: masterSchema });
export type MasterDb = typeof masterDb;
