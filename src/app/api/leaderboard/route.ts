import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { users } from "@/db/schema/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { TENANT_HEADER } from "@/lib/tenant-context";

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER) || request.headers.get("x-tenant-override");
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = resolveSubdomain(request);
    const session = await getCurrentSession();

    const targetSubdomain = subdomain || session?.tenantSubdomain;
    if (!targetSubdomain) {
      return NextResponse.json(
        { success: false, error: "Не вказано сабдомен компанії" },
        { status: 400 }
      );
    }

    // Only return leaderboard for the tenant the user has access to
    if (session && session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено" },
        { status: 403 }
      );
    }

    const leaderboard = await withTenantDb(targetSubdomain, async (db) => {
      const topLearners = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          points: users.points,
        })
        .from(users)
        .orderBy(desc(users.points))
        .limit(10);

      return topLearners;
    });

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("Помилка завантаження лідерборду:", error);
    return NextResponse.json(
      { success: false, error: "Не вдалося завантажити рейтинг" },
      { status: 500 }
    );
  }
}
