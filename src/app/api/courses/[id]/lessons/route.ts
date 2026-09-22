import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenantDb } from "@/db/connection-manager";
import { lessons, courses } from "@/db/schema/tenant";
import { getTenantBySubdomain } from "@/lib/services/tenant-service";
import { TENANT_HEADER } from "@/lib/tenant-context";
import { eq, asc } from "drizzle-orm";

const createLessonSchema = z.object({
  title: z.string().min(2, "Назва повинна містити щонайменше 2 символи").max(255),
  content: z.union([z.string(), z.array(z.any())]).optional(),
  order: z.number().int().optional().default(0),
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
    return NextResponse.json(
      { success: false, error: "Missing tenant identification." },
      { status: 400 }
    );
  }

  const courseId = params.id;

  try {
    const courseLessons = await withTenantDb(subdomain, async (db) => {
      return await db
        .select()
        .from(lessons)
        .where(eq(lessons.courseId, courseId))
        .orderBy(asc(lessons.order));
    });

    return NextResponse.json({ success: true, data: courseLessons });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);

  if (!subdomain) {
    return NextResponse.json(
      { success: false, error: "Missing tenant identification." },
      { status: 400 }
    );
  }

  const courseId = params.id;

  try {
    const body = await request.json();
    const parsed = createLessonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { title, content, order } = parsed.data;
    const serializedContent =
      typeof content === "object" ? JSON.stringify(content) : (content || null);

    const [createdLesson] = await withTenantDb(subdomain, async (db) => {
      // Verify course exists in current tenant schema
      const [existingCourse] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!existingCourse) {
        throw new Error("Курс не знайдено для даної компанії.");
      }

      return await db
        .insert(lessons)
        .values({
          courseId,
          title,
          content: serializedContent,
          order: order ?? 0,
        })
        .returning();
    });

    return NextResponse.json(
      {
        success: true,
        message: "Урок успішно додано",
        data: createdLesson,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Database error" },
      { status: 500 }
    );
  }
}
