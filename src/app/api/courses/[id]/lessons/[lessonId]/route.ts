import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { lessons } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

const updateLessonSchema = z.object({
  title: z.string().min(2, "Назва повинна містити щонайменше 2 символи").max(255).optional(),
  content: z.union([z.string(), z.array(z.any())]).optional(),
  order: z.number().int().optional(),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен" }, { status: 400 });
  }

  const { id: courseId, lessonId } = params;

  try {
    const [lesson] = await withTenantDb(subdomain, async (db) => {
      return await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
        .limit(1);
    });

    if (!lesson) {
      return NextResponse.json({ success: false, error: "Урок не знайдено" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: lesson });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка бази даних" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен" }, { status: 400 });
  }

  const { id: courseId, lessonId } = params;

  try {
    const body = await request.json();
    const parsed = updateLessonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const { title, content, order } = parsed.data;

    // Convert content array to JSON string if needed
    const serializedContent =
      typeof content === "object" ? JSON.stringify(content) : content;

    const [updated] = await withTenantDb(subdomain, async (db) => {
      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (serializedContent !== undefined) updateData.content = serializedContent;
      if (order !== undefined) updateData.order = order;

      return await db
        .update(lessons)
        .set(updateData)
        .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
        .returning();
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Урок не знайдено для оновлення" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Урок успішно оновлено",
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка оновлення уроку" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен" }, { status: 400 });
  }

  const { id: courseId, lessonId } = params;

  try {
    const [deleted] = await withTenantDb(subdomain, async (db) => {
      return await db
        .delete(lessons)
        .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
        .returning();
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Урок не знайдено для видалення" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Урок успішно видалено" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка видалення уроку" },
      { status: 500 }
    );
  }
}
