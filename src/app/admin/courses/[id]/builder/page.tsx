"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Course, Lesson, ContentBlock, Quiz } from "@/db/schema/tenant";
import { BlockEditor } from "@/components/course-builder/BlockEditor";
import { LessonReorderList } from "@/components/course-builder/LessonReorderList";
import {
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  BookOpen,
  Eye,
  Loader2,
  Sparkles,
  Layers,
  Globe,
  Lock,
  FileQuestion,
  Plus,
  Award,
  Trash2,
  ExternalLink,
} from "lucide-react";

export default function CourseBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = params?.id as string;
  const queryTenant = searchParams.get("tenant") || searchParams.get("__tenant") || "";

  // State
  const [tenantSubdomain, setTenantSubdomain] = useState<string>(queryTenant);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [sidebarTab, setSidebarTab] = useState<"lessons" | "quizzes">("lessons");

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeLessonTitle, setActiveLessonTitle] = useState<string>("");
  const [activeBlocks, setActiveBlocks] = useState<ContentBlock[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [savingLesson, setSavingLesson] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // New Quiz Modal
  const [showNewQuizModal, setShowNewQuizModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizPassingScore, setNewQuizPassingScore] = useState(70);
  const [newQuizPoints, setNewQuizPoints] = useState(25);
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // 1. Resolve tenant and verify admin/instructor permissions
  useEffect(() => {
    async function checkAuthAndResolveTenant() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (data.user.role !== "admin" && data.user.role !== "instructor") {
              router.push("/learn?error=insufficient_permissions");
              return;
            }
            if (!tenantSubdomain && data.user.tenantSubdomain) {
              setTenantSubdomain(data.user.tenantSubdomain);
            }
          } else {
            router.push("/login?error=unauthorized");
          }
        } else {
          router.push("/login?error=unauthorized");
        }
      } catch (e) {
        console.error("Помилка отримання сесії:", e);
      }
    }
    checkAuthAndResolveTenant();
  }, [tenantSubdomain, router]);

  // 2. Fetch course, lessons, and quizzes
  const loadCourseData = useCallback(async () => {
    if (!courseId || !tenantSubdomain) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/courses/${courseId}?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          headers: { "x-tenant-override": tenantSubdomain },
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося завантажити курс");
      }

      setCourse(data.data.course);
      const fetchedLessons: Lesson[] = data.data.lessons || [];
      setLessons(fetchedLessons);

      if (fetchedLessons.length > 0 && !activeLessonId) {
        selectLesson(fetchedLessons[0], fetchedLessons);
      }

      // Load quizzes
      const qRes = await fetch(
        `/api/courses/${courseId}/quizzes?tenant=${encodeURIComponent(tenantSubdomain)}`,
        { headers: { "x-tenant-override": tenantSubdomain } }
      );
      const qData = await qRes.json();
      if (qData.success) {
        setQuizzes(qData.data || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка завантаження даних");
    } finally {
      setLoading(false);
    }
  }, [courseId, tenantSubdomain]);

  useEffect(() => {
    if (tenantSubdomain && courseId) {
      loadCourseData();
    }
  }, [tenantSubdomain, courseId, loadCourseData]);

  // Select and parse lesson
  const selectLesson = (lesson: Lesson, lessonList = lessons) => {
    setActiveLessonId(lesson.id);
    setActiveLessonTitle(lesson.title);
    setHasChanges(false);

    let parsedBlocks: ContentBlock[] = [];
    if (lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content);
        if (Array.isArray(parsed)) {
          parsedBlocks = parsed;
        } else if (typeof parsed === "string") {
          parsedBlocks = [
            { id: "b1", type: "heading", level: 1, text: lesson.title },
            { id: "b2", type: "text", text: parsed },
          ];
        }
      } catch {
        parsedBlocks = [
          { id: "b1", type: "heading", level: 1, text: lesson.title },
          { id: "b2", type: "text", text: lesson.content },
        ];
      }
    } else {
      parsedBlocks = [
        { id: "b1", type: "heading", level: 1, text: lesson.title },
        { id: "b2", type: "text", text: "Введіть зміст цього уроку..." },
      ];
    }

    setActiveBlocks(parsedBlocks);
  };

  const handleLessonSelection = (id: string) => {
    const target = lessons.find((l) => l.id === id);
    if (target) {
      selectLesson(target);
    }
  };

  const handleBlocksChange = (newBlocks: ContentBlock[]) => {
    setActiveBlocks(newBlocks);
    setHasChanges(true);
  };

  // Save current lesson
  const handleSaveLesson = async () => {
    if (!activeLessonId || !courseId || !tenantSubdomain) return;

    setSavingLesson(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${activeLessonId}?tenant=${encodeURIComponent(
          tenantSubdomain
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            title: activeLessonTitle,
            content: activeBlocks,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося зберегти урок");
      }

      setLessons((prev) =>
        prev.map((l) =>
          l.id === activeLessonId
            ? { ...l, title: activeLessonTitle, content: JSON.stringify(activeBlocks) }
            : l
        )
      );

      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка при збереженні");
    } finally {
      setSavingLesson(false);
    }
  };

  // Create new quiz
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim() || !courseId || !tenantSubdomain) return;

    setCreatingQuiz(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/quizzes?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            title: newQuizTitle.trim(),
            passingScore: newQuizPassingScore,
            rewardPoints: newQuizPoints,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося створити тест");
      }

      const created = data.data as Quiz;
      setQuizzes([created, ...quizzes]);
      setShowNewQuizModal(false);
      setNewQuizTitle("");

      // Redirect to quiz builder
      router.push(
        `/admin/courses/${courseId}/quizzes/${created.id}/builder?tenant=${tenantSubdomain}`
      );
    } catch (err: any) {
      alert(err.message || "Помилка створення тесту");
    } finally {
      setCreatingQuiz(false);
    }
  };

  // Delete quiz
  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Ви впевнені, що бажаєте видалити цей тест?")) return;

    try {
      const res = await fetch(
        `/api/quizzes/${quizId}?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "DELETE",
          headers: { "x-tenant-override": tenantSubdomain },
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Course Publishing
  const handleTogglePublish = async () => {
    if (!course || !tenantSubdomain) return;
    const nextStatus = !course.isPublished;

    try {
      const res = await fetch(
        `/api/courses/${course.id}?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({ isPublished: nextStatus }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося змінити статус публікації");
      }

      setCourse({ ...course, isPublished: nextStatus });
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка оновлення курсу");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Завантаження конструктора курсу...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href={tenantSubdomain ? `/admin?tenant=${tenantSubdomain}` : "/admin"}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-850 border border-slate-700/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            До панелі керування
          </Link>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/60 text-indigo-300 font-mono">
                {tenantSubdomain}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {course?.title || "Конструктор курсу"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Publish Toggle */}
          {course && (
            <button
              type="button"
              onClick={handleTogglePublish}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                course.isPublished
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60"
                  : "bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60"
              }`}
            >
              {course.isPublished ? (
                <>
                  <Globe className="h-3.5 w-3.5" /> Опубліковано
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" /> Чернетка
                </>
              )}
            </button>
          )}

          {/* Save Lesson Button */}
          {activeLessonId && (
            <button
              type="button"
              disabled={savingLesson || !hasChanges}
              onClick={handleSaveLesson}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-lg ${
                hasChanges
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 animate-pulse"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
              } disabled:opacity-50`}
            >
              {savingLesson ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Збереження...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Збережено!
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {hasChanges ? "Зберегти зміни" : "Збережено"}
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Sidebar with tabs (Lessons vs Quizzes) */}
        <aside className="w-72 sm:w-80 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col shrink-0 space-y-4">
          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setSidebarTab("lessons")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                sidebarTab === "lessons"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Уроки ({lessons.length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("quizzes")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                sidebarTab === "quizzes"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileQuestion className="h-3.5 w-3.5" />
              Тести ({quizzes.length})
            </button>
          </div>

          {sidebarTab === "lessons" ? (
            <LessonReorderList
              courseId={courseId}
              lessons={lessons}
              activeLessonId={activeLessonId}
              onSelectLesson={handleLessonSelection}
              onLessonsChange={(updated) => setLessons(updated)}
              tenantSubdomain={tenantSubdomain}
            />
          ) : (
            /* Quizzes List & Creation */
            <div className="flex flex-col h-full space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-300">
                  Тести курсу ({quizzes.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewQuizModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                >
                  <Plus className="h-3 w-3" /> Створити тест
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {quizzes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                    У курсі ще немає тестів.
                    <br />
                    Натисніть кнопку вище, щоб створити тест.
                  </div>
                ) : (
                  quizzes.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white truncate max-w-[160px]">
                          {q.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuiz(q.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Прохідний: {q.passingScore}%</span>
                        <span className="text-amber-400 font-semibold font-mono">
                          +{q.rewardPoints} б.
                        </span>
                      </div>

                      <Link
                        href={`/admin/courses/${courseId}/quizzes/${q.id}/builder?tenant=${tenantSubdomain}`}
                        className="w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <FileQuestion className="h-3 w-3" />
                        Редагувати питання →
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Right Column: Active Lesson Block Editor */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-3 shadow-lg">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {activeLessonId ? (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="h-4 w-4 text-indigo-400" />
                      Редагування уроку
                    </span>
                    {hasChanges && (
                      <span className="text-amber-400 font-medium text-[11px] bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                        • Незбережені зміни
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Назва уроку:
                    </label>
                    <input
                      type="text"
                      value={activeLessonTitle}
                      onChange={(e) => {
                        setActiveLessonTitle(e.target.value);
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <BlockEditor
                  blocks={activeBlocks}
                  onChange={handleBlocksChange}
                  tenantSubdomain={tenantSubdomain}
                />
              </div>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Оберіть або створіть урок</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Оберіть урок із програми зліва або натисніть «Додати новий урок», щоб перейти до створення навчальних блоків.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE QUIZ MODAL */}
      {showNewQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-indigo-400" />
                Створення тесту
              </h3>
              <button
                onClick={() => setShowNewQuizModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Назва тесту *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  placeholder="Наприклад: Підсумковий тест до Модуля 1"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Прохідний бал (%)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={newQuizPassingScore}
                    onChange={(e) => setNewQuizPassingScore(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Бали за складання
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={newQuizPoints}
                    onChange={(e) => setNewQuizPoints(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewQuizModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={creatingQuiz || !newQuizTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {creatingQuiz ? "Створення..." : "Створити та відкрити →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
