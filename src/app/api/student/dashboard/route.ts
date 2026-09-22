import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";
import { withTenantDb } from "@/db/connection-manager";
import { courses, lessons, quizzes, userProgress, users } from "@/db/schema/tenant";
import { TENANT_HEADER } from "@/lib/tenant-context";

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER);
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function GET(request: NextRequest) {
  try {
    const subdomain = resolveSubdomain(request);
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Потрібна авторизація." },
        { status: 401 }
      );
    }

    const targetSubdomain = subdomain || session.tenantSubdomain;
    if (session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено." },
        { status: 403 }
      );
    }

    const dashboardData = await withTenantDb(targetSubdomain, async (db) => {
      // 1. Get user profile details
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      // 2. Fetch all published courses
      const allCourses = await db
        .select()
        .from(courses)
        .where(eq(courses.isPublished, true))
        .orderBy(desc(courses.createdAt));

      // 3. Fetch all lessons and quizzes for these courses
      const allLessons = await db.select().from(lessons).orderBy(lessons.order);
      const allQuizzes = await db.select().from(quizzes).orderBy(quizzes.createdAt);

      // 4. Fetch all progress records for this student
      const studentProgress = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, session.userId))
        .orderBy(desc(userProgress.completedAt));

      // Pre-process completed lesson IDs
      const completedLessonIds = new Set<string>();
      // Map quiz attempts: quizId -> best attempt
      const quizAttemptsMap: Record<string, { score: number; passed: boolean; completedAt: Date; pointsAwarded: number }> = {};

      for (const p of studentProgress) {
        if (p.activityType === "lesson" && p.lessonId) {
          completedLessonIds.add(p.lessonId);
        } else if (p.activityType === "quiz" && p.quizId) {
          if (!quizAttemptsMap[p.quizId] || p.score > quizAttemptsMap[p.quizId].score) {
            quizAttemptsMap[p.quizId] = {
              score: p.score,
              passed: p.passed,
              completedAt: p.completedAt,
              pointsAwarded: p.pointsAwarded,
            };
          }
        }
      }

      // 5. Aggregate progress per course
      const passedQuizIds = new Set(
        studentProgress
          .filter((p) => p.activityType === "quiz" && p.passed)
          .map((p) => p.quizId || p.id)
      );
      let totalLessonsCompleted = completedLessonIds.size;
      let totalQuizzesPassed = passedQuizIds.size;
      let completedCoursesCount = 0;
      let inProgressCoursesCount = 0;

      const courseCards = allCourses.map((c) => {
        const courseLessons = allLessons.filter((l) => l.courseId === c.id);
        const courseQuizzes = allQuizzes.filter((q) => q.courseId === c.id);

        const totalLessonsCount = courseLessons.length;
        const completedCourseLessons = courseLessons.filter((l) => completedLessonIds.has(l.id));
        const completedLessonsCount = completedCourseLessons.length;

        // Progress percentage
        const progressPercent = totalLessonsCount > 0
          ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
          : 0;

        // Next uncompleted lesson
        const nextLesson = courseLessons.find((l) => !completedLessonIds.has(l.id));

        // Quiz statuses
        const courseQuizCards = courseQuizzes.map((q) => {
          const attempt = quizAttemptsMap[q.id] || null;
          return {
            id: q.id,
            title: q.title,
            passingScore: q.passingScore,
            rewardPoints: q.rewardPoints,
            attempt,
          };
        });

        // Determine if entire course is completed (all lessons + quizzes passed if any)
        const allLessonsDone = totalLessonsCount > 0 && completedLessonsCount === totalLessonsCount;
        const allQuizzesDone = courseQuizzes.length === 0 || courseQuizzes.every((q) => quizAttemptsMap[q.id]?.passed);
        const isCompleted = allLessonsDone && allQuizzesDone;

        if (isCompleted) {
          completedCoursesCount++;
        } else if (completedLessonsCount > 0 || courseQuizCards.some((q) => q.attempt !== null)) {
          inProgressCoursesCount++;
        }

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          totalLessons: totalLessonsCount,
          completedLessons: completedLessonsCount,
          progressPercent,
          isCompleted,
          nextLessonId: nextLesson?.id || null,
          quizzes: courseQuizCards,
          createdAt: c.createdAt,
        };
      });

      return {
        user: {
          id: currentUser?.id || session.userId,
          name: currentUser?.name || session.name,
          email: currentUser?.email || session.email,
          role: currentUser?.role || session.role,
          points: currentUser?.points || 0,
          lastLoginAt: currentUser?.lastLoginAt || null,
        },
        stats: {
          totalCourses: allCourses.length,
          completedCourses: completedCoursesCount,
          inProgressCourses: inProgressCoursesCount,
          notStartedCourses: Math.max(0, allCourses.length - completedCoursesCount - inProgressCoursesCount),
          totalLessonsCompleted,
          totalQuizzesPassed,
          points: currentUser?.points || 0,
        },
        courses: courseCards,
      };
    });

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error: any) {
    console.error("Помилка завантаження студентського дашборду:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
