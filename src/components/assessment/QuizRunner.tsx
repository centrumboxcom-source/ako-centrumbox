"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Award,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Check,
  X,
  CircleDot,
  CheckSquare,
  Loader2,
  Trophy,
} from "lucide-react";

interface OptionItem {
  id: string;
  optionText: string;
}

interface QuestionItem {
  id: string;
  questionText: string;
  questionType: "single" | "multiple";
  points: number;
  options: OptionItem[];
}

interface QuizData {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  passingScore: number;
  rewardPoints: number;
  questions: QuestionItem[];
}

interface FeedbackOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

interface FeedbackQuestion {
  questionId: string;
  questionText: string;
  questionType: "single" | "multiple";
  isCorrect: boolean;
  pointsEarned: number;
  pointsMax: number;
  explanation?: string | null;
  userSelectedIds: string[];
  correctOptionIds: string[];
  options: FeedbackOption[];
}

interface EvaluationResult {
  score: number;
  passed: boolean;
  passingScore: number;
  earnedPoints: number;
  totalPoints: number;
  pointsAwarded: number;
  userTotalPoints?: number;
  detailedFeedback: FeedbackQuestion[];
}

interface QuizRunnerProps {
  quizId: string;
  tenantSubdomain: string;
  onCompleted?: (result: EvaluationResult) => void;
}

export function QuizRunner({ quizId, tenantSubdomain, onCompleted }: QuizRunnerProps) {
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected answers state: questionId -> array of optionIds
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/quizzes/${quizId}?tenant=${encodeURIComponent(tenantSubdomain)}`,
          {
            headers: { "x-tenant-override": tenantSubdomain },
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Не вдалося завантажити тест");
        }
        setQuiz(data.data);
      } catch (err: any) {
        setError(err.message || "Помилка завантаження тесту");
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId, tenantSubdomain]);

  // Handle option selection
  const handleSelectOption = (questionId: string, optionId: string, type: "single" | "multiple") => {
    if (evaluation) return; // Locked after submission

    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      } else {
        // Multiple: toggle checkbox
        const exists = current.includes(optionId);
        const next = exists ? current.filter((id) => id !== optionId) : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
    });
  };

  // Submit test
  const handleSubmit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/quizzes/${quiz.id}/submit?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            answers: selectedAnswers,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося оцінити тест");
      }

      setEvaluation(data.data);
      if (onCompleted) {
        onCompleted(data.data);
      }
    } catch (err: any) {
      setError(err.message || "Помилка при надсиланні відповідей");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setEvaluation(null);
    setSelectedAnswers({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Завантаження матеріалів тестування...</span>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
        <span>{error || "Тест не знайдено."}</span>
      </div>
    );
  }

  const answeredQuestionsCount = Object.keys(selectedAnswers).filter(
    (qId) => (selectedAnswers[qId] || []).length > 0
  ).length;
  const totalQuestions = quiz.questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestionsCount / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Quiz Top Summary Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <FileQuestion className="h-4 w-4" />
              Тестування знань
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{quiz.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
              Прохідний: {quiz.passingScore}%
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1">
              <Award className="h-3.5 w-3.5" /> +{quiz.rewardPoints} балів
            </span>
          </div>
        </div>

        {quiz.description && (
          <p className="text-xs text-slate-600 leading-relaxed">{quiz.description}</p>
        )}

        {/* Progress Bar (during quiz) */}
        {!evaluation && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>
                Відповідей: <strong className="text-slate-900">{answeredQuestionsCount}</strong> з {totalQuestions}
              </span>
              <span className="font-mono text-indigo-600 font-bold">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* EVALUATION RESULTS BANNER */}
      {evaluation && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-md space-y-4 ${
            evaluation.passed
              ? "bg-emerald-50/80 border-emerald-200"
              : "bg-rose-50/80 border-rose-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3.5">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  evaluation.passed ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                }`}
              >
                {evaluation.passed ? <Trophy className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  {evaluation.passed ? "Вітаємо! Тест успішно складено! 🎉" : "Тест не складено"}
                </h2>
                <p className="text-xs text-slate-600">
                  Ваш результат: <strong className="text-slate-900 font-mono">{evaluation.score}%</strong> (прохідний бал: {evaluation.passingScore}%)
                </p>
              </div>
            </div>

            {evaluation.pointsAwarded > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 font-bold text-xs shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                +{evaluation.pointsAwarded} балів нараховано в профіль!
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4 text-xs text-slate-700">
              <span>
                Правильних відповідей: <strong className="text-emerald-700 font-bold">{evaluation.earnedPoints}</strong> / {evaluation.totalPoints} балів
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition border border-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Спробувати знову
              </button>
              <Link
                href={`/profile?tenant=${encodeURIComponent(tenantSubdomain)}`}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
              >
                Особистий профіль →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONS LIST */}
      <div className="space-y-4">
        {quiz.questions.map((q, qIdx) => {
          const userSelected = selectedAnswers[q.id] || [];
          const feedback = evaluation?.detailedFeedback?.find((f) => f.questionId === q.id);

          return (
            <div
              key={q.id}
              className={`p-5 sm:p-6 rounded-2xl bg-white border transition shadow-sm space-y-4 ${
                feedback
                  ? feedback.isCorrect
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-rose-300 bg-rose-50/40"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold flex items-center justify-center text-[11px]">
                    {qIdx + 1}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {q.questionType === "single" ? "Одна правильна відповідь" : "Кілька відповідей"}
                  </span>
                </div>

                {feedback ? (
                  <span
                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      feedback.isCorrect
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {feedback.isCorrect ? (
                      <>
                        <Check className="h-3 w-3" /> Вірно (+{feedback.pointsEarned} б.)
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" /> Невірно (0 б.)
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {q.points} {q.points === 1 ? "бал" : "бали"}
                  </span>
                )}
              </div>

              {/* Question Text */}
              <h3 className="text-base font-bold text-slate-900 leading-relaxed">{q.questionText}</h3>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const isSelected = userSelected.includes(opt.id);

                  // If evaluated, show correct/incorrect state
                  const optFeedback = feedback?.options?.find((o) => o.id === opt.id);
                  const isActuallyCorrect = optFeedback?.isCorrect;

                  let borderClass = "border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300";
                  if (isSelected) {
                    borderClass = "border-indigo-600 bg-indigo-50/80 shadow-sm";
                  }

                  if (evaluation) {
                    if (isActuallyCorrect) {
                      borderClass = "border-emerald-500 bg-emerald-50 text-emerald-900";
                    } else if (isSelected && !isActuallyCorrect) {
                      borderClass = "border-rose-400 bg-rose-50 text-rose-900";
                    }
                  }

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(q.id, opt.id, q.questionType)}
                      className={`p-3.5 rounded-xl border transition flex items-center gap-3 cursor-pointer ${borderClass}`}
                    >
                      {/* Radio or Checkbox icon */}
                      <div
                        className={`h-4 w-4 rounded-${
                          q.questionType === "single" ? "full" : "md"
                        } flex items-center justify-center transition border ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 text-transparent"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </div>

                      <span className="text-sm font-medium text-slate-800 flex-1">
                        {opt.optionText}
                      </span>

                      {evaluation && isActuallyCorrect && (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Правильна відповідь
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Post-submit explanation */}
              {feedback?.explanation && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  <strong className="block font-semibold text-indigo-700 mb-0.5">Пояснення:</strong>
                  {feedback.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!evaluation && (
        <div className="pt-4 flex items-center justify-end">
          <button
            type="button"
            disabled={submitting || answeredQuestionsCount === 0}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Оцінювання відповідей на сервері...
              </>
            ) : (
              <>
                Завершити тест та отримати результат
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
