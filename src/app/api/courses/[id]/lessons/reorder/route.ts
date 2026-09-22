import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { lessons } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

const reorderSchema = z.object({
  orderedLessonIds: z.array(z.string().uuid("Невірний формат UUID")),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен" }, { status: 400 });
  }

  const courseId = params.id;

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const { orderedLessonIds } = parsed.data;

    // Batch update order within tenant transaction
    await withTenantDb(subdomain, async (db) => {
      for (let i = 0; i < orderedLessonIds.length; i++) {
        const lessonId = orderedLessonIds[i];
        await db
          .update(lessons)
          .set({ order: i + 1 })
          .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)));
      }
    });

    return NextResponse.json({
      success: true,
      message: `Порядок для ${orderedLessonIds.length} уроків успішно збережено`,
    });
  } catch (error) {
    console.error("Помилка сортування уроків:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка збереження порядку" },
      { status: 500 }
    );
  }
}
