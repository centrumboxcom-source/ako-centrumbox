import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { users, UserRole } from "@/db/schema/tenant";
import { getTenantBySubdomain } from "@/lib/services/tenant-service";
import { hashPassword } from "@/lib/auth/password";
import { TENANT_HEADER } from "@/lib/tenant-context";

const registerSchema = z.object({
  email: z.string().email("Введіть коректну адресу email"),
  password: z.string().min(6, "Пароль повинен містити щонайменше 6 символів"),
  name: z.string().min(2, "Ім'я повинно містити щонайменше 2 символи"),
  role: z.enum(["admin", "instructor", "student"]).optional().default("student"),
  subdomain: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, name, role } = parsed.data;

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
          error: "Не вказано сабдомен компанії. Реєстрація працівника можлива лише в контексті конкретного тенанта.",
        },
        { status: 400 }
      );
    }

    // Check tenant existence
    const tenant = await getTenantBySubdomain(subdomain);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: `Компанію '${subdomain}' не знайдено.` },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Register user in isolated tenant schema
    const newUser = await withTenantDb(subdomain, async (db) => {
      // Check if email already registered in this tenant
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);

      if (existing) {
        throw new Error(`Користувач із цією адресою вже зареєстрований у компанії '${subdomain}'`);
      }

      const [created] = await db
        .insert(users)
        .values({
          email: email.toLowerCase().trim(),
          name: name.trim(),
          passwordHash,
          role: role as UserRole,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: `Користувача успішно зареєстровано в схемі '${subdomain}'`,
        user: { ...newUser, tenantSubdomain: subdomain },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Помилка реєстрації користувача:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Не вдалося зареєструвати користувача",
      },
      { status: 400 }
    );
  }
}
