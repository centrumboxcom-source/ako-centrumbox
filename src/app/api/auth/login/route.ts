import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { users } from "@/db/schema/tenant";
import { getTenantBySubdomain } from "@/lib/services/tenant-service";
import { verifyPassword } from "@/lib/auth/password";
import { signTenantToken, AUTH_COOKIE_NAME } from "@/lib/auth/jwt";
import { TENANT_HEADER } from "@/lib/tenant-context";

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

    // Resolve subdomain: from request headers, query, or explicit body
    const subdomain = (
      request.headers.get(TENANT_HEADER) ||
      request.headers.get("x-tenant-override") ||
      request.nextUrl.searchParams.get("tenant") ||
      parsed.data.subdomain ||
      ""
    )
      .trim()
      .toLowerCase();

    if (!subdomain) {
      return NextResponse.json(
        {
          success: false,
          error: "Не вказано сабдомен компанії. Авторизація можлива лише в контексті конкретного тенанта.",
        },
        { status: 400 }
      );
    }

    // 1. Check if tenant exists in Master DB
    const tenant = await getTenantBySubdomain(subdomain);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: `Компанію із сабдоменом '${subdomain}' не знайдено.` },
        { status: 404 }
      );
    }

    if (!tenant.isActive) {
      return NextResponse.json(
        { success: false, error: `Компанія '${subdomain}' деактивована.` },
        { status: 403 }
      );
    }

    // 2. Query user STRICTLY within the tenant's isolated schema
    const authResult = await withTenantDb(subdomain, async (db) => {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (!foundUser) {
        return { error: `Користувача не знайдено в просторі компанії '${subdomain}'` };
      }

      const isValid = await verifyPassword(password, foundUser.passwordHash);
      if (!isValid) {
        return { error: "Невірний пароль" };
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, foundUser.id));

      return { user: foundUser };
    });

    if ("error" in authResult && authResult.error) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const user = authResult.user!;

    // 3. Generate JWT Token bound to tenant and role
    const token = await signTenantToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantSubdomain: subdomain,
    });

    // 4. Return response with HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: `Успішний вхід у простір '${subdomain}'`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantSubdomain: subdomain,
      },
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
