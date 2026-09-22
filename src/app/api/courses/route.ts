import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDb } from "@/db/connection-manager";
import { courses } from "@/db/schema/tenant";
import { getTenantBySubdomain } from "@/lib/services/tenant-service";
import { TENANT_HEADER } from "@/lib/tenant-context";
import { desc, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

const createCourseSchema = z.object({
  title: z.string().min(2, "Назва повинна містити щонайменше 2 символи").max(255),
  description: z.string().max(2000).optional(),
  isPublished: z.boolean().optional().default(false),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(request: NextRequest) {
  const subdomain = resolveSubdomain(request);

  if (!subdomain) {
    return NextResponse.json(
      {
        success: false,
        error: "Відсутня ідентифікація компанії. Передайте заголовок 'x-tenant-subdomain' або параметр '?tenant=subdomain'.",
      },
      { status: 400 }
    );
  }

  // Перевірка наявності тенанта в master DB
  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) {
    return NextResponse.json(
      { success: false, error: `Компанію '${subdomain}' не знайдено.` },
      { status: 404 }
    );
  }

  if (!tenant.isActive) {
    return NextResponse.json(
      { success: false, error: `Компанія '${subdomain}' деактивована.` },
      { status: 403 }
    );
  }

  try {
    const session = await getCurrentSession();
    const isAdminOrInstructor = session?.role === "admin" || session?.role === "instructor";

    // Ізольований запит через Connection Manager
    const tenantCourses = await withTenantDb(subdomain, async (db) => {
      // Admins and instructors see drafts and published; students see only published courses
      if (isAdminOrInstructor) {
        return await db.select().from(courses).orderBy(desc(courses.createdAt));
      } else {
        return await db
          .select()
          .from(courses)
          .where(eq(courses.isPublished, true))
          .orderBy(desc(courses.createdAt));
      }
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      data: tenantCourses,
    });
  } catch (error) {
    console.error(`Помилка отримання курсів для компанії ${subdomain}:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка бази даних" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const subdomain = resolveSubdomain(request);

  if (!subdomain) {
    return NextResponse.json(
      {
        success: false,
        error: "Відсутня ідентифікація компанії. Передайте заголовок 'x-tenant-subdomain' або параметр '?tenant=subdomain'.",
      },
      { status: 400 }
    );
  }

  // RBAC Check: Only admin or instructor can create courses
  const session = await getCurrentSession();
  if (!session || (session.role !== "admin" && session.role !== "instructor")) {
    return NextResponse.json(
      { success: false, error: "Недостатньо прав. Створювати курси можуть лише адміністратори або інструктори." },
      { status: 403 }
    );
  }

  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant) {
    return NextResponse.json(
      { success: false, error: `Компанію '${subdomain}' не знайдено.` },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { title, description, isPublished } = parsed.data;

    // Ізольоване додавання запису в схему конкретного тенанта
    const [createdCourse] = await withTenantDb(subdomain, async (db) => {
      return await db
        .insert(courses)
        .values({
          title,
          description: description || null,
          isPublished: isPublished ?? false,
        })
        .returning();
    });

    return NextResponse.json(
      {
        success: true,
        message: `Курс успішно створено у схемі '${subdomain}'`,
        data: createdCourse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`Помилка створення курсу для ${subdomain}:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка бази даних" },
      { status: 500 }
    );
  }
}
