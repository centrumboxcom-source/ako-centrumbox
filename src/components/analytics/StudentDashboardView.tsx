"use client";

import React from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  ArrowRight,
  PlayCircle,
  FileQuestion,
  Star,
  Sparkles,
  Layers,
  AlertCircle,
} from "lucide-react";

export interface StudentDashboardProps {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      points: number;
    };
    stats: {
      totalCourses: number;
      completedCourses: number;
      inProgressCourses: number;
      notStartedCourses: number;
      totalLessonsCompleted: number;
      totalQuizzesPassed: number;
      points: number;
    };
    courses: Array<{
      id: string;
      title: string;
      description: string | null;
      totalLessons: number;
      completedLessons: number;
      progressPercent: number;
      isCompleted: boolean;
      nextLessonId: string | null;
      quizzes: Array<{
        id: string;
        title: string;
        passingScore: number;
        rewardPoints: number;
        attempt: {
          score: number;
          passed: boolean;
          completedAt: string;
          pointsAwarded: number;
        } | null;
      }>;
    }>;
  };
  tenantSubdomain: string;
  onSelectCourse: (courseId: string, lessonId?: string) => void;
}

export function StudentDashboardView({
  data,
  tenantSubdomain,
  onSelectCourse,
}: StudentDashboardProps) {
  const { stats, courses } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Всього курсів
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{stats.totalCourses}</span>
            <BookOpen className="h-5 w-5 text-indigo-400 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-500">Призначено компанією</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Завершено курсів
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {stats.completedCourses}
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-500">
            {stats.inProgressCourses} у процесі навчання
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Пройдено лекцій
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-indigo-300">
              {stats.totalLessonsCompleted}
            </span>
            <Layers className="h-5 w-5 text-indigo-400 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-500">По всіх курсах</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Складено тестів
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-purple-400">
              {stats.totalQuizzesPassed}
            </span>
            <Award className="h-5 w-5 text-purple-400 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-500">Успішних атестацій</span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-900/80 border border-amber-500/30 shadow-lg space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300 block">
            Бали ⭐
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{stats.points}</span>
            <Star className="h-5 w-5 text-amber-400 shrink-0 fill-amber-400" />
          </div>
          <Link
            href={`/profile?tenant=${tenantSubdomain}`}
            className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1 transition"
          >
            Переглянути ранг →
          </Link>
        </div>
      </div>

      {/* 2. Assigned Courses Progress Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-400" />
              Призначені навчальні курси та статус прогресу
            </h2>
            <p className="text-xs text-slate-400">
              Відстежуйте проходження кожної лекції та результати перевірочних тестувань.
            </p>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/40 space-y-3">
            <BookOpen className="h-10 w-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-white">Для вас ще немає призначених курсів</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Очікуйте публікації навчальних програм вашим HR-відділом або адміністратором компанії.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {courses.map((c) => (
              <div
                key={c.id}
                className={`p-6 rounded-3xl border transition flex flex-col justify-between shadow-xl ${
                  c.isCompleted
                    ? "bg-emerald-950/20 border-emerald-800/60 hover:border-emerald-700/80"
                    : c.progressPercent > 0
                    ? "bg-slate-900/80 border-slate-800 hover:border-indigo-500/50"
                    : "bg-slate-950/80 border-slate-850 hover:border-slate-800"
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header: Title & Completed badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white line-clamp-1">{c.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                        {c.description || "Опис програми відсутній."}
                      </p>
                    </div>

                    {c.isCompleted ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Завершено
                      </span>
                    ) : c.progressPercent > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-700 text-indigo-300 text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <Clock className="h-3.5 w-3.5" /> У процесі
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-[11px] font-medium shrink-0">
                        Не розпочато
                      </span>
                    )}
                  </div>

                  {/* Progress Bar & Counter (Lector X з Y) */}
                  <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Пройдено лекцій:{" "}
                        <strong className="text-white font-mono">
                          {c.completedLessons} з {c.totalLessons}
                        </strong>
                      </span>
                      <span className="text-indigo-400 font-bold font-mono">
                        {c.progressPercent}%
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          c.isCompleted
                            ? "bg-emerald-500"
                            : c.progressPercent > 0
                            ? "bg-indigo-500"
                            : "bg-slate-700"
                        }`}
                        style={{ width: `${c.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Quizzes Status Section */}
                  {c.quizzes.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Підсумкові тестування ({c.quizzes.length}):
                      </span>

                      <div className="space-y-1.5">
                        {c.quizzes.map((q) => (
                          <div
                            key={q.id}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileQuestion className="h-4 w-4 text-purple-400 shrink-0" />
                              <span className="text-slate-300 font-medium truncate">{q.title}</span>
                            </div>

                            {q.attempt ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    q.attempt.passed
                                      ? "bg-emerald-950 border border-emerald-800 text-emerald-300"
                                      : "bg-rose-950 border border-rose-800 text-rose-300"
                                  }`}
                                >
                                  {q.attempt.score}%{" "}
                                  {q.attempt.passed ? "(Складено 🎉)" : "(Не складено)"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px] shrink-0 font-medium">
                                Ще не пройдено (Поріг: {q.passingScore}%)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Button */}
                <div className="pt-4 mt-4 border-t border-slate-850 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {c.totalLessons} {c.totalLessons === 1 ? "урок" : "уроків"} в програмі
                  </span>

                  <button
                    onClick={() => onSelectCourse(c.id, c.nextLessonId || undefined)}
                    className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                      c.isCompleted
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25"
                    }`}
                  >
                    {c.isCompleted ? (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        Переглянути матеріали
                      </>
                    ) : c.progressPercent > 0 ? (
                      <>
                        Продовжити навчання <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Розпочати навчання <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
