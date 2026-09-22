import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";
import { withTenantDb } from "@/db/connection-manager";
import { users, courses, lessons, quizzes, userProgress } from "@/db/schema/tenant";
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

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Доступ дозволено лише адміністраторам компанії (HR)." },
        { status: 403 }
      );
    }

    const targetSubdomain = subdomain || session.tenantSubdomain;
    if (session.tenantSubdomain.toLowerCase() !== targetSubdomain.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Міжклієнтський доступ заборонено." },
        { status: 403 }
      );
    }

    const analytics = await withTenantDb(targetSubdomain, async (db) => {
      // 1. Fetch all employees in this tenant schema
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt));

      // 2. Fetch all courses, lessons, quizzes
      const allCourses = await db.select().from(courses).orderBy(desc(courses.createdAt));
      const allLessons = await db.select().from(lessons).orderBy(lessons.order);
      const allQuizzes = await db.select().from(quizzes).orderBy(quizzes.createdAt);

      // 3. Fetch all progress records
      const allProgress = await db.select().from(userProgress).orderBy(desc(userProgress.completedAt));

      // Map progress by user: userId -> list of userProgress
      const progressByUser: Record<string, typeof allProgress> = {};
      allProgress.forEach((p) => {
        if (!progressByUser[p.userId]) {
          progressByUser[p.userId] = [];
        }
        progressByUser[p.userId].push(p);
      });

      // 4. Build Matrix of Employee Performance
      let totalPointsSum = 0;
      let totalCompletedCoursesSum = 0;
      let totalProgressPercentSum = 0;
      let evaluatedCourseCount = 0;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let activeEmployeesCount = 0;

      const employeeRows = allUsers.map((u) => {
        totalPointsSum += u.points;

        const userRecords = progressByUser[u.id] || [];
        const latestActivityDate = userRecords.length > 0 ? userRecords[0].completedAt : null;

        // Determine real last activity / login
        const lastActive = u.lastLoginAt
          ? (latestActivityDate && latestActivityDate > u.lastLoginAt ? latestActivityDate : u.lastLoginAt)
          : latestActivityDate;

        if (lastActive && new Date(lastActive) >= thirtyDaysAgo) {
          activeEmployeesCount++;
        }

        // Set of completed lesson IDs for this user
        const completedLessonsSet = new Set(
          userRecords.filter((r) => r.activityType === "lesson" && r.lessonId).map((r) => r.lessonId!)
        );

        // Map best quiz score: quizId -> { score, passed }
        const userQuizzesMap: Record<string, { score: number; passed: boolean; completedAt: Date }> = {};
        userRecords.forEach((r) => {
          if (r.activityType === "quiz" && r.quizId) {
            if (!userQuizzesMap[r.quizId] || r.score > userQuizzesMap[r.quizId].score) {
              userQuizzesMap[r.quizId] = {
                score: r.score,
                passed: r.passed,
                completedAt: r.completedAt,
              };
            }
          }
        });

        // Course details
        const coursesProgress = allCourses.map((c) => {
          const courseLessons = allLessons.filter((l) => l.courseId === c.id);
          const courseQuizzes = allQuizzes.filter((q) => q.courseId === c.id);

          const totalLessons = courseLessons.length;
          const completedLessons = courseLessons.filter((l) => completedLessonsSet.has(l.id)).length;

          const progressPercent = totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

          // Quiz summaries for this course
          const quizStats = courseQuizzes.map((q) => {
            const attempt = userQuizzesMap[q.id] || null;
            return {
              quizId: q.id,
              quizTitle: q.title,
              passingScore: q.passingScore,
              attempt,
            };
          });

          const isCourseCompleted =
            totalLessons > 0 &&
            completedLessons === totalLessons &&
            (courseQuizzes.length === 0 || courseQuizzes.every((q) => userQuizzesMap[q.id]?.passed));

          if (isCourseCompleted) {
            totalCompletedCoursesSum++;
          }

          totalProgressPercentSum += progressPercent;
          evaluatedCourseCount++;

          return {
            courseId: c.id,
            courseTitle: c.title,
            isPublished: c.isPublished,
            totalLessons,
            completedLessons,
            progressPercent,
            isCompleted: isCourseCompleted,
            quizzes: quizStats,
          };
        });

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          points: u.points,
          lastLoginAt: lastActive,
          createdAt: u.createdAt,
          courses: coursesProgress,
        };
      });

      // 5. Company-wide KPIs
      const totalEmployees = allUsers.length;
      const avgCompletionRate = evaluatedCourseCount > 0
        ? Math.round(totalProgressPercentSum / evaluatedCourseCount)
        : 0;

      // Quiz statistics
      const allQuizAttempts = allProgress.filter((p) => p.activityType === "quiz");
      const avgQuizScore = allQuizAttempts.length > 0
        ? Math.round(allQuizAttempts.reduce((acc, a) => acc + a.score, 0) / allQuizAttempts.length)
        : 0;
      const quizPassRate = allQuizAttempts.length > 0
        ? Math.round((allQuizAttempts.filter((a) => a.passed).length / allQuizAttempts.length) * 100)
        : 0;

      // 6. Course-specific metrics
      const courseMetrics = allCourses.map((c) => {
        const courseLessons = allLessons.filter((l) => l.courseId === c.id);
        const courseQuizzes = allQuizzes.filter((q) => q.courseId === c.id);

        let completedCount = 0;
        let inProgressCount = 0;
        let notStartedCount = 0;

        employeeRows.forEach((emp) => {
          const cp = emp.courses.find((x) => x.courseId === c.id);
          if (cp?.isCompleted) {
            completedCount++;
          } else if (cp && cp.completedLessons > 0) {
            inProgressCount++;
          } else {
            notStartedCount++;
          }
        });

        const courseQuizAttempts = allQuizAttempts.filter((a) => a.courseId === c.id);
        const courseAvgScore = courseQuizAttempts.length > 0
          ? Math.round(courseQuizAttempts.reduce((acc, a) => acc + a.score, 0) / courseQuizAttempts.length)
          : 0;

        return {
          id: c.id,
          title: c.title,
          isPublished: c.isPublished,
          lessonsCount: courseLessons.length,
          quizzesCount: courseQuizzes.length,
          completedCount,
          inProgressCount,
          notStartedCount,
          avgQuizScore: courseAvgScore,
        };
      });

      return {
        summary: {
          totalEmployees,
          activeEmployeesCount,
          totalCourses: allCourses.length,
          avgCompletionRate,
          avgQuizScore,
          quizPassRate,
          totalPointsAwarded: totalPointsSum,
        },
        courses: allCourses.map((c) => ({ id: c.id, title: c.title })),
        courseMetrics,
        employees: employeeRows,
      };
    });

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Помилка завантаження HR-аналітики:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
