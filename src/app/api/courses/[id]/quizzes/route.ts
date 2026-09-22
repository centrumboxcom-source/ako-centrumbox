import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { quizzes, courses, questions } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

const createQuizSchema = z.object({
  title: z.string().min(2, "Назва тесту повинна містити щонайменше 2 символи").max(255),
  description: z.string().max(2000).optional().nullable(),
  passingScore: z.number().int().min(1).max(100).optional().default(70),
  rewardPoints: z.number().int().min(0).max(1000).optional().default(25),
  lessonId: z.string().uuid().optional().nullable(),
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER) || request.headers.get("x-tenant-override");
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
    const courseQuizzes = await withTenantDb(subdomain, async (db) => {
      return await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.courseId, courseId))
        .orderBy(desc(quizzes.createdAt));
    });

    return NextResponse.json({ success: true, data: courseQuizzes });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка бази даних" },
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
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const courseId = params.id;

  try {
    const body = await request.json();
    const parsed = createQuizSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const { title, description, passingScore, rewardPoints, lessonId } = parsed.data;

    const [createdQuiz] = await withTenantDb(subdomain, async (db) => {
      // Verify course exists
      const [existingCourse] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!existingCourse) {
        throw new Error("Курс не знайдено для даної компанії");
      }

      return await db
        .insert(quizzes)
        .values({
          courseId,
          lessonId: lessonId || null,
          title,
          description: description || null,
          passingScore: passingScore ?? 70,
          rewardPoints: rewardPoints ?? 25,
        })
        .returning();
    });

    return NextResponse.json(
      {
        success: true,
        message: "Тест успішно створено",
        data: createdQuiz,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка створення тесту" },
      { status: 500 }
    );
  }
}
