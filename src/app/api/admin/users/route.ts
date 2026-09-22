import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";
import { withTenantDb } from "@/db/connection-manager";
import { users } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = resolveSubdomain(request);
    const session = await getCurrentSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ лише для адміністраторів (HR)." },
        { status: 403 }
      );
    }

    const targetSubdomain = subdomain || session.tenantSubdomain;
    if (session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено." },
        { status: 403 }
      );
    }

    const userList = await withTenantDb(targetSubdomain, async (db) => {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          points: users.points,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      return rows;
    });

    return NextResponse.json({
      success: true,
      data: userList,
    });
  } catch (error: any) {
    console.error("Помилка отримання співробітників:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
