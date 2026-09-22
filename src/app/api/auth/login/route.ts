import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { users } from "@/db/schema/tenant";
import { getAllTenants, getTenantBySubdomain } from "@/lib/services/tenant-service";
import { verifyPassword } from "@/lib/auth/password";
import { signTenantToken, AUTH_COOKIE_NAME } from "@/lib/auth/jwt";
import { TENANT_HEADER } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Введіть коректну адресу email"),
  password: z.string().min(1, "Пароль обов'язковий"),
  subdomain: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check optional subdomain passed in headers, query, or body
    const explicitSubdomain = (
      parsed.data.subdomain ||
      request.headers.get(TENANT_HEADER) ||
      request.headers.get("x-tenant-override") ||
      request.nextUrl.searchParams.get("tenant") ||
      ""
    ).trim().toLowerCase();

    let matchedTenant: string | null = null;
    let authenticatedUser: any = null;

    // 1. If explicit subdomain was provided, check it first
    if (explicitSubdomain) {
      const tenant = await getTenantBySubdomain(explicitSubdomain);
      if (tenant && tenant.isActive) {
        try {
          const user = await withTenantDb(explicitSubdomain, async (db) => {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1);
            return u;
          });

          if (user) {
            const isValid = await verifyPassword(password, user.passwordHash);
            if (isValid) {
              matchedTenant = explicitSubdomain;
              authenticatedUser = user;
            }
          }
        } catch {
          // ignore error and proceed to search
        }
      }
    }

    // 2. If not matched in explicit subdomain, search across all active tenants
    if (!authenticatedUser) {
      const allTenants = await getAllTenants();
      for (const t of allTenants) {
        if (!t.isActive) continue;
        if (t.subdomain === explicitSubdomain) continue; // already checked

        try {
          const user = await withTenantDb(t.subdomain, async (db) => {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1);
            return u;
          });

          if (user) {
            const isValid = await verifyPassword(password, user.passwordHash);
            if (isValid) {
              matchedTenant = t.subdomain;
              authenticatedUser = user;
              break;
            }
          }
        } catch {
          // continue checking other tenant schemas
        }
      }
    }

    // 3. If no matching user found or wrong password
    if (!authenticatedUser || !matchedTenant) {
      return NextResponse.json(
        { success: false, error: "Невірний email або пароль." },
        { status: 401 }
      );
    }

    // 4. Update last login timestamp
    try {
      await withTenantDb(matchedTenant, async (db) => {
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, authenticatedUser.id));
      });
    } catch (err) {
      console.error("Failed to update lastLoginAt:", err);
    }

    // 5. Generate JWT Token bound to resolved tenant and role
    const token = await signTenantToken({
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
      role: authenticatedUser.role,
      tenantSubdomain: matchedTenant,
    });

    // 6. Compute smart destination route based on role
    const requestedFrom =
      request.nextUrl.searchParams.get("from") ||
      request.nextUrl.searchParams.get("redirect");

    let redirectTo = `/learn?tenant=${matchedTenant}`;

    if (requestedFrom && requestedFrom !== "/login" && !requestedFrom.startsWith("/login")) {
      redirectTo = requestedFrom;
    } else if (authenticatedUser.role === "admin") {
      redirectTo = `/admin?tenant=${matchedTenant}`;
    } else if (authenticatedUser.role === "instructor") {
      redirectTo = `/admin?tenant=${matchedTenant}`;
    } else {
      redirectTo = `/learn?tenant=${matchedTenant}`;
    }

    // 7. Return response with HTTP-only cookie and destination
    const response = NextResponse.json({
      success: true,
      message: `Успішний вхід у простір '${matchedTenant}'`,
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        tenantSubdomain: matchedTenant,
      },
      redirectTo,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Помилка авторизації:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Помилка сервера під час входу",
      },
      { status: 500 }
    );
  }
}
