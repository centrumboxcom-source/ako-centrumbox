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
  const activeTenant = searchParams.get("tenant") || "acme";
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
  const [completingLesson, setCompletingLesson] = useState(false);
  const [pointsNotice, setPointsNotice] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"curriculum" | "reader" | "dashboard">("curriculum");
  const [dashboardData, setDashboardData] = useState<any>(null);

  const loadDashboard = async (tenant: string) => {
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadUserPoints = async (tenant: string) => {
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
        if (data.authenticated) {
          setCurrentUser(data.user);
          const tenant = data.user.tenantSubdomain || activeTenant;
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
          router.push(`/login?tenant=${encodeURIComponent(activeTenant)}`);
        }
      })
      .catch(() => router.push(`/login?tenant=${encodeURIComponent(activeTenant)}`))
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

  const startQuiz = (quiz: QuizItem) => {
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
          setPointsNotice(`🎉 Урок успішно пройдено! Вам нараховано +${data.data.pointsAwarded} балів.`);
        } else {
          setPointsNotice("Урок уже зараховано раніше.");
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Модулі та атестація курсу
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {lessons.length} уроків • {quizzes.length} контрольних тестів
              </span>
            </div>

            <div className="space-y-3">
              {/* Lessons */}
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => startLesson(lesson)}
                  className="ako-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:border-indigo-300 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                      {lesson.order}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {lesson.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        Лекційний матеріал • Інтерактивні блоки
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      +{lesson.points || 10} б.
                    </span>

                    <button className="px-3.5 py-1.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white text-xs font-bold transition flex items-center gap-1">
                      <span>Відкрити</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Quizzes */}
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  onClick={() => startQuiz(quiz)}
                  className="ako-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4 cursor-pointer border-amber-200 bg-amber-50/20 hover:bg-amber-50/50 hover:border-amber-300 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-200">
                      <FileQuestion className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                          ТЕСТ
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-amber-800 transition truncate">
                          {quiz.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Прохідний бал: {quiz.passingScore}% • Оцінювання на бекенді
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                      +{quiz.rewardPoints} балів
                    </span>

                    <button className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold transition shadow-sm">
                      Пройти тест
                    </button>
                  </div>
                </div>
              ))}
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
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>{pointsNotice}</span>
              </div>
            )}

            {/* Lesson Material Paper */}
            {activeItem?.type === "lesson" && activeLesson && (
              <div className="ako-card p-6 sm:p-10 rounded-3xl space-y-8 bg-white">
                <div className="border-b border-slate-100 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 block mb-1">
                    Модуль {activeLesson.order}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {activeLesson.title}
                  </h2>
                </div>

                <div className="prose max-w-none text-slate-700 leading-relaxed">
                  <BlockRenderer blocks={activeBlocks} />
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Завершіть вивчення для отримання +{activeLesson.points || 10} балів</span>
                  </div>

                  <button
                    onClick={() => handleCompleteLesson(activeLesson)}
                    disabled={completingLesson}
                    className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2"
                  >
                    {completingLesson ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <span>Позначити як завершено (+10 балів)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quiz Material */}
            {activeItem?.type === "quiz" && activeQuiz && (
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
