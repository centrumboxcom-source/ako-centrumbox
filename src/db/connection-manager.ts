import { Pool, PoolClient } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as tenantSchema from "./schema/tenant";
import { masterPool } from "./master";

export type TenantDb = NodePgDatabase<typeof tenantSchema>;

/**
 * Validates and sanitizes a tenant schema name to prevent SQL injection.
 * Schema names in Postgres can be quoted identifiers matching [a-z0-9_].
 */
export function sanitizeSchemaName(subdomain: string): string {
  const normalized = subdomain.trim().toLowerCase().replace(/-/g, "_");
  if (!/^[a-z0-9_]{1,63}$/.test(normalized)) {
    throw new Error(`Invalid schema name: "${subdomain}". Must only contain alphanumeric characters, hyphens, and underscores.`);
  }
  return normalized;
}

/**
 * Executes a callback within a scoped tenant database transaction with isolated search_path.
 * Uses `SET LOCAL search_path TO "tenant_schema", public`, which guarantees that:
 * 1. All queries executed inside the callback target the specific tenant's schema.
 * 2. `SET LOCAL` is automatically reset upon transaction completion (COMMIT/ROLLBACK),
 *    preventing any connection pool pollution or cross-tenant leakage.
 */
export async function withTenantDb<T>(
  subdomain: string,
  callback: (db: TenantDb, client: PoolClient) => Promise<T>
): Promise<T> {
  const schemaName = sanitizeSchemaName(subdomain);
  const client = await masterPool.connect();

  try {
    await client.query("BEGIN;");
    // Safely set search_path for the transaction
    await client.query(`SET LOCAL search_path TO "${schemaName}", public;`);

    const tenantDb = drizzle(client, { schema: tenantSchema });
    const result = await callback(tenantDb, client);

    await client.query("COMMIT;");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK;");
    } catch (rollbackError) {
      console.error("Error during transaction rollback:", rollbackError);
    }
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Low-level runner for raw SQL queries within a tenant schema scope.
 */
export async function withTenantRawClient<T>(
  subdomain: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const schemaName = sanitizeSchemaName(subdomain);
  const client = await masterPool.connect();

  try {
    await client.query("BEGIN;");
    await client.query(`SET LOCAL search_path TO "${schemaName}", public;`);
    const result = await callback(client);
    await client.query("COMMIT;");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK;");
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
