import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { quizzes, questions, questionOptions, userProgress, users } from "@/db/schema/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { TENANT_HEADER } from "@/lib/tenant-context";

const submitSchema = z.object({
  answers: z.record(z.array(z.string())), // questionId -> array of selected optionIds
  userEmail: z.string().email().optional(), // fallback if running from dev or specific context
});

function resolveSubdomain(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get(TENANT_HEADER) || request.headers.get("x-tenant-override");
  const querySubdomain = request.nextUrl.searchParams.get("tenant") || request.nextUrl.searchParams.get("__tenant");
  const subdomain = headerSubdomain || querySubdomain;
  return subdomain ? subdomain.trim().toLowerCase() : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const subdomain = resolveSubdomain(request);
  if (!subdomain) {
    return NextResponse.json({ success: false, error: "Не вказано сабдомен компанії" }, { status: 400 });
  }

  const quizId = params.id;

  try {
    const body = await request.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const { answers, userEmail } = parsed.data;

    // Resolve user session
    const session = await getCurrentSession();
    const activeEmail = session?.email || userEmail;

    if (!activeEmail) {
      return NextResponse.json(
        { success: false, error: "Необхідно авторизуватися для проходження тесту" },
        { status: 401 }
      );
    }

    const evaluation = await withTenantDb(subdomain, async (db) => {
      // 1. Fetch user from tenant schema
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, activeEmail.toLowerCase().trim()))
        .limit(1);

      if (!currentUser) {
        throw new Error(`Користувача ${activeEmail} не знайдено в просторі компанії`);
      }

      // 2. Fetch quiz details
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);

      if (!quiz) {
        throw new Error("Тест не знайдено");
      }

      // 3. Fetch questions and their options directly from DB (with correct answers!)
      const dbQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId));

      if (dbQuestions.length === 0) {
        throw new Error("У цьому тесті немає запитань для перевірки");
      }

      let earnedPoints = 0;
      let totalPoints = 0;
      const detailedFeedback = [];

      for (const q of dbQuestions) {
        const dbOptions = await db
          .select()
          .from(questionOptions)
          .where(eq(questionOptions.questionId, q.id));

        const correctOptionIds = dbOptions
          .filter((opt) => opt.isCorrect)
          .map((opt) => opt.id);

        const userSelectedIds = answers[q.id] || [];

        let isQuestionCorrect = false;

        if (q.questionType === "single") {
          // Single choice: exactly one selected, and it matches the correct one
          isQuestionCorrect =
            userSelectedIds.length === 1 &&
            correctOptionIds.length === 1 &&
            userSelectedIds[0] === correctOptionIds[0];
        } else {
          // Multiple choice: sets must match exactly
          const sortedSelected = [...userSelectedIds].sort();
          const sortedCorrect = [...correctOptionIds].sort();
          isQuestionCorrect =
            sortedSelected.length === sortedCorrect.length &&
            sortedSelected.every((val, idx) => val === sortedCorrect[idx]);
        }

        const questionPoints = q.points || 1;
        totalPoints += questionPoints;

        if (isQuestionCorrect) {
          earnedPoints += questionPoints;
        }

        detailedFeedback.push({
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          isCorrect: isQuestionCorrect,
          pointsEarned: isQuestionCorrect ? questionPoints : 0,
          pointsMax: questionPoints,
          explanation: q.explanation || null,
          userSelectedIds,
          correctOptionIds,
          options: dbOptions.map((o) => ({
            id: o.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
          })),
        });
      }

      // 4. Calculate percentage score
      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = score >= quiz.passingScore;

      // 5. Points reward logic (Award once for first pass)
      let pointsAwarded = 0;

      if (passed) {
        // Check if previously passed
        const [previousPass] = await db
          .select()
          .from(userProgress)
          .where(
            and(
              eq(userProgress.userId, currentUser.id),
              eq(userProgress.quizId, quizId),
              eq(userProgress.passed, true)
            )
          )
          .limit(1);

        if (!previousPass) {
          pointsAwarded = quiz.rewardPoints ?? 25;

          // Increment user's point balance
          await db
            .update(users)
            .set({ points: currentUser.points + pointsAwarded })
            .where(eq(users.id, currentUser.id));
        }
      }

      // 6. Record progress in user_progress table
      const [progressRecord] = await db
        .insert(userProgress)
        .values({
          userId: currentUser.id,
          activityType: "quiz",
          title: quiz.title,
          courseId: quiz.courseId,
          quizId: quiz.id,
          score,
          passed,
          pointsAwarded,
          answers: JSON.stringify(detailedFeedback),
        })
        .returning();

      return {
        score,
        passed,
        passingScore: quiz.passingScore,
        earnedPoints,
        totalPoints,
        pointsAwarded,
        userTotalPoints: currentUser.points + pointsAwarded,
        detailedFeedback,
        progressId: progressRecord.id,
        completedAt: progressRecord.completedAt,
      };
    });

    return NextResponse.json({
      success: true,
      message: evaluation.passed
        ? `Вітаємо! Тест успішно складено (${evaluation.score}%). Нараховано +${evaluation.pointsAwarded} балів.`
        : `Тест не складено (${evaluation.score}% при прохідному ${evaluation.passingScore}%). Спробуйте ще раз.`,
      data: evaluation,
    });
  } catch (error) {
    console.error("Помилка оцінювання тесту:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка оцінювання тесту" },
      { status: 500 }
    );
  }
}
