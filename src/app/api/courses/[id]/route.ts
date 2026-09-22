import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { courses, lessons } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

const updateCourseSchema = z.object({
  title: z.string().min(2, "Назва повинна містити щонайменше 2 символи").max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().optional(),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const courseId = params.id;

  try {
    const result = await withTenantDb(subdomain, async (db) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!course) return null;

      const courseLessons = await db
        .select()
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.order));

      return { ...course, lessons: courseLessons };
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "Курс не знайдено" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка бази даних" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const courseId = params.id;

  try {
    const body = await request.json();
    const parsed = updateCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const [updated] = await withTenantDb(subdomain, async (db) => {
      return await db
        .update(courses)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, courseId))
        .returning();
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Курс не знайдено для оновлення" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка оновлення курсу" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const courseId = params.id;

  try {
    const [deleted] = await withTenantDb(subdomain, async (db) => {
      return await db
        .delete(courses)
        .where(eq(courses.id, courseId))
        .returning();
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Курс не знайдено для видалення" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Курс успішно видалено" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка видалення курсу" },
      { status: 500 }
    );
  }
}
