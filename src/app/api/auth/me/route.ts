import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AUTH_COOKIE_NAME } from "@/lib/auth/jwt";
import { getTenantBySubdomain } from "@/lib/services/tenant-service";
import { masterDb } from "@/db/master";
import { platformAdmins } from "@/db/schema/master";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    const res = NextResponse.json(
      { success: false, authenticated: false, user: null },
      { status: 401 }
    );
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  // 1. Validate platform superadmin
  if (session.tenantSubdomain === "master") {
    try {
      const [admin] = await masterDb
        .select()
        .from(platformAdmins)
        .where(eq(platformAdmins.id, session.userId))
        .limit(1);

      if (!admin) {
        const res = NextResponse.json(
          { success: false, authenticated: false, user: null },
          { status: 401 }
        );
        res.cookies.delete(AUTH_COOKIE_NAME);
        return res;
      }
    } catch {
      const res = NextResponse.json(
        { success: false, authenticated: false, user: null },
        { status: 401 }
      );
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
  } else {
    // 2. Validate tenant existence in database
    try {
      const tenant = await getTenantBySubdomain(session.tenantSubdomain);
      if (!tenant || !tenant.isActive) {
        const res = NextResponse.json(
          { success: false, authenticated: false, user: null, error: "Організацію видалено" },
          { status: 401 }
        );
        res.cookies.delete(AUTH_COOKIE_NAME);
        return res;
      }
    } catch {
      const res = NextResponse.json(
        { success: false, authenticated: false, user: null },
        { status: 401 }
      );
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
  }

  return NextResponse.json(
    {
      success: true,
      authenticated: true,
      user: session,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
