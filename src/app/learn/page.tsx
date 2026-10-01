"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Play,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Check,
  BookOpen,
  Sparkles,
  FileQuestion,
  Award,
  Trophy,
  LayoutDashboard,
  Clock,
  ArrowLeft,
  ListOrdered,
  Lock,
  Unlock,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { BlockRenderer } from "@/components/course-builder/BlockRenderer";
import { QuizRunner } from "@/components/assessment/QuizRunner";
import { StudentDashboardView } from "@/components/analytics/StudentDashboardView";
import { SpotifyShell } from "@/components/navigation/SpotifyShell";
import { ContentBlock } from "@/db/schema/tenant";

interface Course {
  id: string;
  title: string;
  description: string | null;
  isPublished?: boolean;
  createdAt: string;
}

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  content: string | null;
  order: number;
  points?: number;
}

interface QuizItem {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  description: string | null;
  passingScore: number;
  rewardPoints: number;
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">Завантаження навчання...</div>}>
      <LearnContent />
    </Suspense>
  );
}

function LearnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTenant = searchParams.get("tenant") || searchParams.get("__tenant") || "";
  const courseQueryParam = searchParams.get("course");
  const lessonQueryParam = searchParams.get("lesson");
  const quizQueryParam = searchParams.get("quiz");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState<number>(50);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);

  const [activeItem, setActiveItem] = useState<{ type: "lesson" | "quiz"; id: string } | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [activeBlocks, setActiveBlocks] = useState<ContentBlock[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [passedQuizzes, setPassedQuizzes] = useState<Record<string, boolean>>({});
  const [completingLesson, setCompletingLesson] = useState(false);
  const [pointsNotice, setPointsNotice] = useState<string | null>(null);

  // Completion modal to immediately prompt student to take test after lesson
  const [promptQuizModal, setPromptQuizModal] = useState<{
    open: boolean;
    quiz: QuizItem | null;
    lesson: Lesson | null;
  }>({ open: false, quiz: null, lesson: null });

  const [viewMode, setViewMode] = useState<"curriculum" | "reader" | "dashboard">("curriculum");
  const [dashboardData, setDashboardData] = useState<any>(null);

  const loadDashboard = async (tenant: string) => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/student/dashboard?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDashboardData(data.data);
        if (data.data?.user?.points !== undefined) {
          setUserPoints(data.data.user.points);
        }
        if (Array.isArray(data.data?.completedLessonIds)) {
          const m: Record<string, boolean> = {};
          data.data.completedLessonIds.forEach((id: string) => {
            m[id] = true;
          });
          setCompletedLessons(m);
        }
        if (Array.isArray(data.data?.passedQuizIds)) {
          const qm: Record<string, boolean> = {};
          data.data.passedQuizIds.forEach((id: string) => {
            qm[id] = true;
          });
          setPassedQuizzes(qm);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadUserPoints = async (tenant: string) => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/profile?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserPoints(data.data?.user?.points || 50);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          const tenant = activeTenant || data.user.tenantSubdomain;
          if (!tenant || tenant === "master") {
            window.location.replace("/superadmin");
            return;
          }

          loadUserPoints(tenant);
          loadDashboard(tenant);

          fetch(`/api/courses?tenant=${encodeURIComponent(tenant)}`, {
            headers: { "x-tenant-override": tenant },
          })
            .then((r) => r.json())
            .then((cData) => {
              if (cData.success) {
                const list: Course[] = cData.data || [];
                setCourses(list);

                if (list.length > 0) {
                  const target = courseQueryParam
                    ? list.find((c) => c.id === courseQueryParam) || list[0]
                    : list[0];
                  loadCourseMaterials(target, tenant);
                }
              }
            });
        } else {
          window.location.replace("/login");
        }
      })
      .catch(() => window.location.replace("/login"))
      .finally(() => setLoading(false));
  }, [router, activeTenant, courseQueryParam]);

  const loadCourseMaterials = async (course: Course, tenant?: string) => {
    setSelectedCourse(course);
    const sub = tenant || activeTenant;

    try {
      const lessonsRes = await fetch(
        `/api/courses/${course.id}/lessons?tenant=${encodeURIComponent(sub)}`,
        { headers: { "x-tenant-override": sub } }
      );
      const lessonsData = await lessonsRes.json();
      const sortedLessons: Lesson[] = lessonsData.success ? lessonsData.data || [] : [];
      setLessons(sortedLessons);

      const quizzesRes = await fetch(
        `/api/courses/${course.id}/quizzes?tenant=${encodeURIComponent(sub)}`,
        { headers: { "x-tenant-override": sub } }
      );
      const quizzesData = await quizzesRes.json();
      const loadedQuizzes: QuizItem[] = quizzesData.success ? quizzesData.data || [] : [];
      setQuizzes(loadedQuizzes);

      // Auto-open specific lesson or quiz if requested in query parameters
      if (lessonQueryParam) {
        const found = sortedLessons.find((l) => l.id === lessonQueryParam);
        if (found) startLesson(found);
      } else if (quizQueryParam) {
        const found = loadedQuizzes.find((q) => q.id === quizQueryParam);
        if (found) startQuiz(found);
      }
    } catch (err) {
      console.error("Помилка завантаження матеріалів:", err);
    }
  };

  const startLesson = (lesson: Lesson) => {
    setActiveItem({ type: "lesson", id: lesson.id });
    setActiveLesson(lesson);
    setActiveQuiz(null);
    setPointsNotice(null);
    setViewMode("reader");

    let parsedBlocks: ContentBlock[] = [];
    if (lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content);
        if (Array.isArray(parsed)) parsedBlocks = parsed;
        else parsedBlocks = [{ id: "b1", type: "heading", level: 1, text: lesson.title }, { id: "b2", type: "text", text: parsed }];
      } catch {
        parsedBlocks = [{ id: "b1", type: "heading", level: 1, text: lesson.title }, { id: "b2", type: "text", text: lesson.content }];
      }
    } else {
      parsedBlocks = [{ id: "b1", type: "heading", level: 1, text: lesson.title }, { id: "b2", type: "text", text: "Контент цього уроку наразі готується." }];
    }
    setActiveBlocks(parsedBlocks);
  };

  const isQuizLocked = (quiz: QuizItem): boolean => {
    // 1. If quiz is tied to a specific lesson, it's locked until that lesson is completed!
    if (quiz.lessonId) {
      return !completedLessons[quiz.lessonId];
    }
    // 2. If quiz is a course-level final exam (no specific lessonId),
    // it requires all lessons in the course to be completed
    if (lessons.length > 0) {
      return lessons.some((l) => !completedLessons[l.id]);
    }
    return false;
  };

  const startQuiz = (quiz: QuizItem) => {
    if (isQuizLocked(quiz)) {
      const relLesson = quiz.lessonId ? lessons.find((l) => l.id === quiz.lessonId) : null;
      setPointsNotice(
        relLesson
          ? `🔒 Тестування заблоковано! Спершу необхідно повністю пройти лекцію "${relLesson.title}", щоб унеможливити підглядання відповідей.`
          : `🔒 Тестування заблоковано! Спершу необхідно завершити всі лекційні матеріали курсу.`
      );
      return;
    }
    setActiveItem({ type: "quiz", id: quiz.id });
    setActiveQuiz(quiz);
    setActiveLesson(null);
    setPointsNotice(null);
    setViewMode("reader");
  };

  const handleCompleteLesson = async (lesson: Lesson) => {
    if (!selectedCourse) return;
    setCompletingLesson(true);
    setPointsNotice(null);

    try {
      const res = await fetch(
        `/api/courses/${selectedCourse.id}/lessons/${lesson.id}/complete?tenant=${encodeURIComponent(activeTenant)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": activeTenant,
          },
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setCompletedLessons((prev) => ({ ...prev, [lesson.id]: true }));
        if (data.data?.pointsAwarded > 0) {
          setUserPoints(data.data.totalPoints);
        }

        // Refresh student dashboard state
        loadDashboard(activeTenant);

        // Check if there is an associated quiz for this lesson
        const relatedQuiz = quizzes.find((q) => q.lessonId === lesson.id);
        if (relatedQuiz && !passedQuizzes[relatedQuiz.id]) {
          // Open prompt modal asking user if they want to take the quiz now
          setPromptQuizModal({
            open: true,
            lesson,
            quiz: relatedQuiz,
          });
        } else {
          setPointsNotice(
            data.data?.pointsAwarded > 0
              ? `🎉 Лекцію успішно пройдено! Вам нараховано +${data.data.pointsAwarded} балів.`
              : "Лекцію зараховано раніше."
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompletingLesson(false);
    }
  };

  const currentLessonIndex = lessons.findIndex((l) => l.id === activeLesson?.id);
  const prevLesson = currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < lessons.length - 1 ? lessons[currentLessonIndex + 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Завантаження навчальних матеріалів...
      </div>
    );
  }

  return (
    <SpotifyShell currentTenant={activeTenant}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Course Header Banner */}
        {selectedCourse && (
          <div className="ako-card rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                  <BookOpen className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                      НАВЧАЛЬНА ПРОГРАМА
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Організація: {activeTenant}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                    {selectedCourse.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                    {selectedCourse.description || "Комплексний навчальний курс для співробітників компанії."}
                  </p>
                </div>
              </div>

              {/* View Selector Controls */}
              <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setViewMode("curriculum")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    viewMode === "curriculum"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                  <span>План уроків ({lessons.length})</span>
                </button>

                <button
                  onClick={() => setViewMode("dashboard")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    viewMode === "dashboard"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Статистика</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 1: Curriculum / Plan */}
        {viewMode === "curriculum" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  План курсу та контрольні тестування
                </h2>
                <p className="text-xs text-slate-500">
                  Вивчайте лекції послідовно. Тести відкриваються тільки після повного проходження матеріалу.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {lessons.length} уроків • {quizzes.length} контрольних тестів
              </span>
            </div>

            <div className="space-y-4">
              {lessons.map((lesson) => {
                const isLessonDone = !!completedLessons[lesson.id];
                const lessonQuizzes = quizzes.filter((q) => q.lessonId === lesson.id);

                return (
                  <div key={lesson.id} className="space-y-2.5">
                    {/* Lesson Item Card */}
                    <div
                      onClick={() => startLesson(lesson)}
                      className={`ako-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:border-indigo-300 group transition ${
                        isLessonDone ? "border-emerald-200/80 bg-emerald-50/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition ${
                            isLessonDone
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : "bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                          }`}
                        >
                          {isLessonDone ? <Check className="h-5 w-5" /> : lesson.order}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {isLessonDone ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Пройдено
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                                До вивчення
                              </span>
                            )}
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                              {lesson.title}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            Лекційний матеріал • Інтерактивні блоки
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          +{lesson.points || 10} б.
                        </span>

                        <button className="px-3.5 py-1.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white text-xs font-bold transition flex items-center gap-1">
                          <span>{isLessonDone ? "Переглянути" : "Читати лекцію"}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Associated Quizzes Attached to this Lesson */}
                    {lessonQuizzes.map((quiz) => {
                      const locked = isQuizLocked(quiz);
                      const isPassed = !!passedQuizzes[quiz.id];

                      return (
                        <div
                          key={quiz.id}
                          onClick={() => {
                            if (locked) {
                              setPointsNotice(
                                `🔒 Тестування заблоковано! Спершу завершіть лекцію "${lesson.title}", щоб унеможливити підглядання відповідей.`
                              );
                            } else {
                              startQuiz(quiz);
                            }
                          }}
                          className={`ml-4 sm:ml-8 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-4 transition border ${
                            locked
                              ? "bg-slate-50/80 border-slate-200 border-dashed opacity-80 cursor-not-allowed"
                              : isPassed
                              ? "bg-emerald-50/30 border-emerald-200 hover:border-emerald-300 cursor-pointer"
                              : "bg-amber-50/30 border-amber-200 hover:border-amber-300 cursor-pointer shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                                locked
                                  ? "bg-slate-200 text-slate-500 border-slate-300"
                                  : isPassed
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                            >
                              {locked ? (
                                <Lock className="h-4 w-4 text-slate-500" />
                              ) : isPassed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <FileQuestion className="h-4 w-4 text-amber-700" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {locked ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase flex items-center gap-1">
                                    <Lock className="h-2.5 w-2.5" />
                                    ЗАБЛОКОВАНО
                                  </span>
                                ) : isPassed ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase flex items-center gap-1">
                                    <Check className="h-2.5 w-2.5" />
                                    СКЛАДЕНО
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                                    ДОСТУПНИЙ ТЕСТ
                                  </span>
                                )}

                                <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {quiz.title}
                                </h5>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {locked
                                  ? `Відкриється після проходження лекції "${lesson.title}"`
                                  : `Прохідний бал: ${quiz.passingScore}% • Оцінювання на сервері`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              +{quiz.rewardPoints} б.
                            </span>

                            {locked ? (
                              <button
                                disabled
                                className="px-3 py-1 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                <span>Заблоковано</span>
                              </button>
                            ) : (
                              <button
                                className={`px-3.5 py-1 rounded-xl text-xs font-bold transition shadow-sm ${
                                  isPassed
                                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                    : "bg-amber-500 hover:bg-amber-600 text-slate-900"
                                }`}
                              >
                                {isPassed ? "Перескласти" : "Пройти тест →"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Course-Level Quizzes (Final Exams / General Assessments) */}
              {quizzes.filter((q) => !q.lessonId).length > 0 && (
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Підсумкова атестація курсу
                    </h3>
                  </div>

                  {quizzes
                    .filter((q) => !q.lessonId)
                    .map((quiz) => {
                      const locked = isQuizLocked(quiz);
                      const isPassed = !!passedQuizzes[quiz.id];

                      return (
                        <div
                          key={quiz.id}
                          onClick={() => {
                            if (locked) {
                              setPointsNotice(
                                "🔒 Підсумковий тест заблоковано! Спершу необхідно успішно завершити всі лекції курсу."
                              );
                            } else {
                              startQuiz(quiz);
                            }
                          }}
                          className={`ako-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 transition ${
                            locked
                              ? "bg-slate-50/80 border-slate-200 border-dashed opacity-80 cursor-not-allowed"
                              : isPassed
                              ? "bg-emerald-50/30 border-emerald-200 cursor-pointer"
                              : "border-indigo-200 bg-indigo-50/20 hover:border-indigo-300 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                                locked
                                  ? "bg-slate-200 text-slate-500 border-slate-300"
                                  : isPassed
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-indigo-100 text-indigo-800 border-indigo-200"
                              }`}
                            >
                              {locked ? (
                                <Lock className="h-5 w-5 text-slate-500" />
                              ) : isPassed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              ) : (
                                <Trophy className="h-5 w-5 text-indigo-600" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {locked ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase flex items-center gap-1">
                                    <Lock className="h-2.5 w-2.5" />
                                    ЗАБЛОКОВАНО
                                  </span>
                                ) : isPassed ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase flex items-center gap-1">
                                    <Check className="h-2.5 w-2.5" />
                                    КУРС СКЛАДЕНО
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 uppercase">
                                    ФІНАЛЬНИЙ ІСПИТ
                                  </span>
                                )}
                                <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                                  {quiz.title}
                                </h4>
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {locked
                                  ? "Завершіть усі уроки курсу, щоб розблокувати підсумковий тест"
                                  : `Прохідний бал: ${quiz.passingScore}% • Винагорода: ${quiz.rewardPoints} балів`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                              +{quiz.rewardPoints} балів
                            </span>

                            {locked ? (
                              <button
                                disabled
                                className="px-4 py-1.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center gap-1"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                <span>Заблоковано</span>
                              </button>
                            ) : (
                              <button className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm">
                                {isPassed ? "Пройти ще раз" : "Почати іспит →"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* View Mode 2: Interactive Reader / Player */}
        {viewMode === "reader" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <button
                onClick={() => setViewMode("curriculum")}
                className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Назад до плану курсу</span>
              </button>

              <div className="flex items-center gap-2">
                {prevLesson && (
                  <button
                    onClick={() => startLesson(prevLesson)}
                    className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Попередній</span>
                  </button>
                )}
                {nextLesson && (
                  <button
                    onClick={() => startLesson(nextLesson)}
                    className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <span className="hidden sm:inline">Наступний</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Points Toast */}
            {pointsNotice && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-2 shadow-sm">
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                <span>{pointsNotice}</span>
              </div>
            )}

            {/* Lesson Material Paper */}
            {activeItem?.type === "lesson" && activeLesson && (
              <div className="ako-card p-6 sm:p-10 rounded-3xl space-y-8 bg-white">
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                      Модуль {activeLesson.order}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                      {activeLesson.title}
                    </h2>
                  </div>

                  {completedLessons[activeLesson.id] && (
                    <span className="self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Пройдено
                    </span>
                  )}
                </div>

                <div className="prose max-w-none text-slate-700 leading-relaxed">
                  <BlockRenderer blocks={activeBlocks} />
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>
                      {completedLessons[activeLesson.id]
                        ? "Матеріал лекції успішно засвоєно."
                        : `Завершіть вивчення для отримання +${activeLesson.points || 10} балів та відкриття тесту`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* If completed and has related quiz, offer to start quiz */}
                    {completedLessons[activeLesson.id] && (
                      <>
                        {(() => {
                          const relQuiz = quizzes.find((q) => q.lessonId === activeLesson.id);
                          if (!relQuiz) return null;
                          return (
                            <button
                              onClick={() => startQuiz(relQuiz)}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs transition shadow-sm flex items-center justify-center gap-2"
                            >
                              <FileQuestion className="h-4 w-4" />
                              <span>Перейти до тестування →</span>
                            </button>
                          );
                        })()}
                      </>
                    )}

                    <button
                      onClick={() => handleCompleteLesson(activeLesson)}
                      disabled={completingLesson || !!completedLessons[activeLesson.id]}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-full font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 ${
                        completedLessons[activeLesson.id]
                          ? "bg-slate-100 text-slate-500 cursor-default border border-slate-200"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      {completingLesson ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>
                        {completedLessons[activeLesson.id]
                          ? "Урок уже зараховано ✓"
                          : "Позначити як завершено (+10 балів)"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quiz Material */}
            {activeItem?.type === "quiz" && activeQuiz && (
              <div className="space-y-6">
                {isQuizLocked(activeQuiz) ? (
                  <div className="ako-card p-8 sm:p-12 rounded-3xl bg-white text-center max-w-2xl mx-auto space-y-6">
                    <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
                      <Lock className="h-8 w-8 text-amber-600" />
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                        Тестування заблоковано
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                        {activeQuiz.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                        Щоб запобігти підгляданню питань та забезпечити чесне оцінювання знань, це тестування відкривається лише після повного вивчення відповідної лекції.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      {activeQuiz.lessonId ? (
                        <button
                          onClick={() => {
                            const targetLesson = lessons.find((l) => l.id === activeQuiz.lessonId);
                            if (targetLesson) startLesson(targetLesson);
                            else setViewMode("curriculum");
                          }}
                          className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2"
                        >
                          <BookOpen className="h-4 w-4" />
                          <span>Перейти до вивчення лекції →</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setViewMode("curriculum")}
                          className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2"
                        >
                          <ListOrdered className="h-4 w-4" />
                          <span>Перейти до плану курсу →</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="ako-card p-6 sm:p-10 rounded-3xl space-y-6 bg-white">
                    <div className="border-b border-slate-100 pb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block mb-1">
                        Контрольне тестування
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                        {activeQuiz.title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">{activeQuiz.description}</p>
                    </div>

                    <QuizRunner
                      quizId={activeQuiz.id}
                      tenantSubdomain={activeTenant}
                      onCompleted={() => {
                        loadUserPoints(activeTenant);
                        loadDashboard(activeTenant);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Post-Lesson Quiz Prompt Modal */}
        {promptQuizModal.open && promptQuizModal.quiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
                <Trophy className="h-8 w-8 text-amber-500 animate-bounce" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 mx-auto">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Лекцію успішно завершено!
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Готові закріпити знання тестом?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                  Ви успішно вивчили тему <strong>"{promptQuizModal.lesson?.title}"</strong>. Тепер перевірте себе у контрольному тестуванні <strong>"{promptQuizModal.quiz.title}"</strong> та заробіть додатково <strong>+{promptQuizModal.quiz.rewardPoints} балів</strong>!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const q = promptQuizModal.quiz;
                    setPromptQuizModal({ open: false, quiz: null, lesson: null });
                    if (q) startQuiz(q);
                  }}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Розпочати тестування зараз →</span>
                </button>

                <button
                  onClick={() => {
                    setPromptQuizModal({ open: false, quiz: null, lesson: null });
                    setViewMode("curriculum");
                  }}
                  className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition"
                >
                  Пройти пізніше
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 3: Analytics */}
        {viewMode === "dashboard" && dashboardData && (
          <div className="ako-card p-6 sm:p-8 rounded-3xl">
            <StudentDashboardView
              data={dashboardData}
              tenantSubdomain={activeTenant}
              onSelectCourse={(courseId) => {
                const c = courses.find((x) => x.id === courseId);
                if (c) {
                  loadCourseMaterials(c);
                  setViewMode("curriculum");
                }
              }}
            />
          </div>
        )}
      </div>
    </SpotifyShell>
  );
}
