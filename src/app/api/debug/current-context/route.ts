import { NextRequest, NextResponse } from "next/server";
import { masterPool } from "@/db/master";
import { withTenantDb } from "@/db/connection-manager";
import { courses } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

export async function GET(request: NextRequest) {
  const subdomain =
    request.headers.get(TENANT_HEADER) ||
    request.nextUrl.searchParams.get("tenant") ||
    null;

  try {
    // 1. Check all custom schemas in PostgreSQL
    const schemasRes = await masterPool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `);
    const availableSchemas = schemasRes.rows.map((r) => r.schema_name);

    let searchPathResult = "public (default)";
    let tenantCoursesCount = 0;

    if (subdomain) {
      const tenantCheck = await withTenantDb(subdomain, async (db, client) => {
        const sp = await client.query("SHOW search_path;");
        const count = await db.select().from(courses);
        return {
          searchPath: sp.rows[0].search_path,
          coursesCount: count.length,
        };
      });
      searchPathResult = tenantCheck.searchPath;
      tenantCoursesCount = tenantCheck.coursesCount;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestedTenant: subdomain,
      database: {
        activeSearchPath: searchPathResult,
        existingSchemas: availableSchemas,
        coursesInThisTenant: tenantCoursesCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Diagnostics failed" },
      { status: 500 }
    );
  }
}
