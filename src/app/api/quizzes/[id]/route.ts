import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { withTenantDb } from "@/db/connection-manager";
import { quizzes, questions, questionOptions } from "@/db/schema/tenant";
import { getCurrentSession } from "@/lib/auth/session";
import { TENANT_HEADER } from "@/lib/tenant-context";

const optionSchema = z.object({
  id: z.string().optional(),
  optionText: z.string().min(1, "Текст варіанту не може бути порожнім"),
  isCorrect: z.boolean().default(false),
  order: z.number().int().optional().default(0),
});

const questionSchema = z.object({
  id: z.string().optional(),
  questionText: z.string().min(2, "Текст питання не може бути порожнім"),
  questionType: z.enum(["single", "multiple"]),
  explanation: z.string().optional().nullable(),
  points: z.number().int().min(1).default(1),
  order: z.number().int().optional().default(0),
  options: z.array(optionSchema).min(2, "Питання повинно мати щонайменше 2 варіанти відповіді"),
});

const updateQuizSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  passingScore: z.number().int().min(1).max(100).optional(),
  rewardPoints: z.number().int().min(0).max(1000).optional(),
  questions: z.array(questionSchema).optional(),
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

  const quizId = params.id;
  const session = await getCurrentSession();
  const isAdminOrInstructor = session && (session.role === "admin" || session.role === "instructor");

  try {
    const quizData = await withTenantDb(subdomain, async (db) => {
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);

      if (!quiz) return null;

      // Fetch questions
      const quizQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId))
        .orderBy(asc(questions.order));

      // Fetch options for all questions
      const populatedQuestions = await Promise.all(
        quizQuestions.map(async (q) => {
          const opts = await db
            .select()
            .from(questionOptions)
            .where(eq(questionOptions.questionId, q.id))
            .orderBy(asc(questionOptions.order));

          // ZERO-CHEAT SECURITY: Strip isCorrect and explanation for students
          const sanitizedOptions = opts.map((opt) => {
            if (!isAdminOrInstructor) {
              const { isCorrect, ...studentOpt } = opt;
              return studentOpt;
            }
            return opt;
          });

          return {
            id: q.id,
            quizId: q.quizId,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            order: q.order,
            // Only reveal explanation to admins, or hide it until after submission
            explanation: isAdminOrInstructor ? q.explanation : null,
            options: sanitizedOptions,
          };
        })
      );

      return {
        ...quiz,
        questions: populatedQuestions,
      };
    });

    if (!quizData) {
      return NextResponse.json({ success: false, error: "Тест не знайдено" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: quizData,
      isEditable: isAdminOrInstructor,
    });
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

  const quizId = params.id;

  try {
    const body = await request.json();
    const parsed = updateQuizSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.format() }, { status: 400 });
    }

    const { title, description, passingScore, rewardPoints, questions: updatedQuestions } = parsed.data;

    const result = await withTenantDb(subdomain, async (db) => {
      // 1. Update quiz details
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (passingScore !== undefined) updateData.passingScore = passingScore;
      if (rewardPoints !== undefined) updateData.rewardPoints = rewardPoints;

      const [updatedQuiz] = await db
        .update(quizzes)
        .set(updateData)
        .where(eq(quizzes.id, quizId))
        .returning();

      if (!updatedQuiz) {
        throw new Error("Тест не знайдено для оновлення");
      }

      // 2. If questions provided, atomically replace questions and options
      if (updatedQuestions) {
        // Delete existing questions (cascade will remove questionOptions)
        await db.delete(questions).where(eq(questions.quizId, quizId));

        for (let qIdx = 0; qIdx < updatedQuestions.length; qIdx++) {
          const q = updatedQuestions[qIdx];
          const [insertedQuestion] = await db
            .insert(questions)
            .values({
              quizId,
              questionText: q.questionText,
              questionType: q.questionType,
              explanation: q.explanation || null,
              points: q.points ?? 1,
              order: q.order ?? qIdx + 1,
            })
            .returning();

          if (q.options && q.options.length > 0) {
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              await db.insert(questionOptions).values({
                questionId: insertedQuestion.id,
                optionText: opt.optionText,
                isCorrect: opt.isCorrect ?? false,
                order: opt.order ?? optIdx + 1,
              });
            }
          }
        }
      }

      return updatedQuiz;
    });

    return NextResponse.json({
      success: true,
      message: "Тест успішно збережено",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка оновлення тесту" },
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

  const quizId = params.id;

  try {
    const [deleted] = await withTenantDb(subdomain, async (db) => {
      return await db.delete(quizzes).where(eq(quizzes.id, quizId)).returning();
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Тест не знайдено для видалення" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Тест успішно видалено" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Помилка видалення тесту" },
      { status: 500 }
    );
  }
}
