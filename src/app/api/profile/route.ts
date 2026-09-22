import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { users, userProgress, courses, quizzes, lessons } from "@/db/schema/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { TENANT_HEADER } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER) || request.headers.get("x-tenant-override");
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

function calculateRank(points: number): {
  title: string;
  badge: string;
  level: number;
  nextTier: number;
  progressPercent: number;
} {
  if (points < 50) {
    return {
      title: "Початківець",
      badge: "🥉",
      level: 1,
      nextTier: 50,
      progressPercent: Math.min(100, Math.round((points / 50) * 100)),
    };
  }
  if (points < 150) {
    return {
      title: "Спеціаліст",
      badge: "🥈",
      level: 2,
      nextTier: 150,
      progressPercent: Math.min(100, Math.round(((points - 50) / 100) * 100)),
    };
  }
  if (points < 300) {
    return {
      title: "Експерт",
      badge: "🥇",
      level: 3,
      nextTier: 300,
      progressPercent: Math.min(100, Math.round(((points - 150) / 150) * 100)),
    };
  }
  return {
    title: "Майстер",
    badge: "💎",
    level: 4,
    nextTier: 500,
    progressPercent: 100,
  };
}

export async function GET(request: NextRequest) {
  const subdomain = resolveSubdomain(request);
  const session = await getCurrentSession();

  const targetTenant = subdomain || session?.tenantSubdomain;
  if (!targetTenant) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const queryEmail = request.nextUrl.searchParams.get("email");
  const activeEmail = session?.email || queryEmail;

  if (!activeEmail) {
    return NextResponse.json(
      { success: false, error: "Необхідно авторизуватися" },
      { status: 401 }
    );
  }

  try {
    const profileData = await withTenantDb(targetTenant, async (db) => {
      // 1. Fetch user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, activeEmail.toLowerCase().trim()))
        .limit(1);

      if (!user) {
        throw new Error("Користувача не знайдено");
      }

      // 2. Fetch all user progress entries
      const progressEntries = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, user.id))
        .orderBy(desc(userProgress.completedAt));

      // 3. Compute statistics
      const lessonsCount = progressEntries.filter((p) => p.activityType === "lesson").length;
      const quizzesPassed = progressEntries.filter(
        (p) => p.activityType === "quiz" && p.passed
      ).length;

      const quizEntries = progressEntries.filter((p) => p.activityType === "quiz");
      const averageQuizScore =
        quizEntries.length > 0
          ? Math.round(
              quizEntries.reduce((acc, curr) => acc + curr.score, 0) / quizEntries.length
            )
          : 0;

      // 4. Enrich history with activity titles
      const history = await Promise.all(
        progressEntries.map(async (entry) => {
          let activityTitle = entry.title || "";

          if (!activityTitle) {
            if (entry.activityType === "lesson" && entry.lessonId) {
              const [lesson] = await db
                .select({ title: lessons.title })
                .from(lessons)
                .where(eq(lessons.id, entry.lessonId))
                .limit(1);
              if (lesson) activityTitle = `Урок: ${lesson.title}`;
            } else if (entry.activityType === "quiz" && entry.quizId) {
              const [quiz] = await db
                .select({ title: quizzes.title })
                .from(quizzes)
                .where(eq(quizzes.id, entry.quizId))
                .limit(1);
              if (quiz) activityTitle = `Тест: ${quiz.title}`;
            }
          }

          if (!activityTitle) {
            activityTitle = entry.activityType === "quiz" ? "Тестування (завершено)" : "Урок курсу";
          }

          return {
            id: entry.id,
            activityType: entry.activityType,
            title: activityTitle,
            score: entry.score,
            passed: entry.passed,
            pointsAwarded: entry.pointsAwarded,
            completedAt: entry.completedAt,
          };
        })
      );

      const rankInfo = calculateRank(user.points || 0);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points || 0,
          tenantSubdomain: targetTenant,
          rank: rankInfo,
        },
        stats: {
          lessonsCompleted: lessonsCount,
          quizzesPassed: quizzesPassed,
          averageQuizScore,
          totalActivities: progressEntries.length,
        },
        history,
      };
    });

    return NextResponse.json({ success: true, data: profileData });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка отримання профілю" },
      { status: 500 }
    );
  }
}
