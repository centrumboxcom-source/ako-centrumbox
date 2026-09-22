import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { lessons, userProgress, users } from "@/db/schema/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { TENANT_HEADER } from "@/lib/tenant-context";

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER) || request.headers.get("x-tenant-override");
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const { id: courseId, lessonId } = params;

  try {
    const session = await getCurrentSession();
    let bodyEmail: string | undefined;
    try {
      const body = await request.json();
      bodyEmail = body?.userEmail;
    } catch {
      // Body is optional
    }

    const activeEmail = session?.email || bodyEmail;

    if (!activeEmail) {
      return NextResponse.json(
        { success: false, error: "Необхідно авторизуватися для позначення уроку" },
        { status: 401 }
      );
    }

    const result = await withTenantDb(subdomain, async (db) => {
      // 1. Fetch user
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, activeEmail.toLowerCase().trim()))
        .limit(1);

      if (!currentUser) {
        throw new Error("Користувача не знайдено");
      }

      // 2. Fetch lesson
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
        .limit(1);

      if (!lesson) {
        throw new Error("Урок не знайдено");
      }

      // 3. Check if already completed
      const [existingProgress] = await db
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, currentUser.id),
            eq(userProgress.lessonId, lessonId),
            eq(userProgress.activityType, "lesson")
          )
        )
        .limit(1);

      if (existingProgress) {
        return {
          alreadyCompleted: true,
          pointsAwarded: 0,
          totalPoints: currentUser.points,
          lessonTitle: lesson.title,
        };
      }

      // 4. Award points for completion
      const pointsToAward = lesson.points ?? 10;
      const newTotalPoints = currentUser.points + pointsToAward;

      await db
        .update(users)
        .set({ points: newTotalPoints })
        .where(eq(users.id, currentUser.id));

      await db.insert(userProgress).values({
        userId: currentUser.id,
        activityType: "lesson",
        title: lesson.title,
        courseId,
        lessonId,
        score: 100,
        passed: true,
        pointsAwarded: pointsToAward,
      });

      return {
        alreadyCompleted: false,
        pointsAwarded: pointsToAward,
        totalPoints: newTotalPoints,
        lessonTitle: lesson.title,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyCompleted
        ? "Урок уже було пройдено раніше"
        : `Урок пройдено! Нараховано +${result.pointsAwarded} балів.`,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка збереження прогресу" },
      { status: 500 }
    );
  }
}
