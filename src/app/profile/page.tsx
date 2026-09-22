"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FileQuestion,
  Check,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { SpotifyShell } from "@/components/navigation/SpotifyShell";

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  tenantSubdomain: string;
  rank: {
    title: string;
    badge: string;
    level: number;
    nextTier: number;
    progressPercent: number;
  };
}

interface ProfileStats {
  lessonsCompleted: number;
  quizzesPassed: number;
  averageQuizScore: number;
  totalActivities: number;
}

interface HistoryItem {
  id: string;
  activityType: "lesson" | "quiz";
  title: string;
  score: number;
  passed: boolean;
  pointsAwarded: number;
  completedAt: string;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">Завантаження профілю...</div>}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTenant = searchParams.get("tenant") || searchParams.get("__tenant") || "";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    user: ProfileUser;
    stats: ProfileStats;
    history: HistoryItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const tenantParam = queryTenant ? `?tenant=${encodeURIComponent(queryTenant)}` : "";
        const res = await fetch(`/api/profile${tenantParam}`, {
          headers: queryTenant ? { "x-tenant-override": queryTenant } : undefined,
        });

        if (res.status === 401) {
          window.location.replace("/login");
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Не вдалося завантажити профіль");
        }

        setProfile(data.data);
      } catch (err: any) {
        setError(err.message || "Помилка завантаження профілю");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [queryTenant, router]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Завантаження особистого кабінету...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <SpotifyShell currentTenant={queryTenant}>
        <div className="max-w-lg mx-auto py-20 px-4 text-center space-y-4">
          <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error || "Профіль не знайдено"}</span>
          </div>
          <Link
            href={`/?tenant=${encodeURIComponent(queryTenant)}`}
            className="inline-block px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition"
          >
            ← Повернутися на головну
          </Link>
        </div>
      </SpotifyShell>
    );
  }

  const { user, stats, history } = profile;

  return (
    <SpotifyShell currentTenant={user.tenantSubdomain}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* User Hero Banner */}
        <div className="ako-card rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
              {/* Avatar with rank ring */}
              <div className="relative shrink-0">
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white text-3xl sm:text-4xl font-black shadow-md shadow-indigo-500/20">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base shadow-sm">
                  {user.rank.badge}
                </div>
              </div>

              {/* User details */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    ВЕРЕФІКОВАНИЙ СПІВРОБІТНИК
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Організація: {user.tenantSubdomain.toUpperCase()}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                  {user.name}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>{user.email}</span>
                  <span>•</span>
                  <span className="font-semibold text-indigo-600">
                    Роль: {user.role === "admin" ? "Адміністратор" : user.role === "instructor" ? "Інструктор" : "Співробітник"}
                  </span>
                  <span>•</span>
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Рівень {user.rank.level}: {user.rank.title}
                  </span>
                </div>
              </div>
            </div>

            {/* Points Balance Card */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center shrink-0 min-w-[180px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                БАЛАНС БАЛІВ
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  {user.points}
                </span>
                <span className="text-sm font-bold text-amber-600">б.</span>
              </div>
              <button
                onClick={handleShare}
                className="mt-1 text-[11px] font-bold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 shadow-sm"
              >
                <Share2 className="h-3 w-3" />
                <span>{copied ? "Скопійовано!" : "Поділитись"}</span>
              </button>
            </div>
          </div>

          {/* Level Progress */}
          <div className="pt-4 border-t border-slate-100 max-w-xl space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>Прогрес до наступного рангу ({user.rank.nextTier} балів)</span>
              <span className="font-mono text-indigo-600 font-bold">{user.rank.progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${user.rank.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="ako-card p-5 rounded-2xl space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
              Пройдено уроків
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.lessonsCompleted}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">+10 балів за кожен</span>
          </div>

          <div className="ako-card p-5 rounded-2xl space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <FileQuestion className="h-3.5 w-3.5 text-amber-600" />
              Складено тестів
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.quizzesPassed}</p>
            <span className="text-[11px] text-amber-700 font-semibold">+30 балів за кожен</span>
          </div>

          <div className="ako-card p-5 rounded-2xl space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Середній бал тестів
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.averageQuizScore}%</p>
            <span className="text-[11px] text-slate-400">Точність відповідей</span>
          </div>

          <div className="ako-card p-5 rounded-2xl space-y-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              Всього активностей
            </span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalActivities}</p>
            <span className="text-[11px] text-slate-400">Уроки та тестування</span>
          </div>
        </div>

        {/* History / Points Timeline */}
        <div className="ako-card p-6 sm:p-8 rounded-3xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                Історія нарахування балів та прогрес
              </h3>
              <p className="text-xs text-slate-500">
                Хронологічний список завершених модулів та успішно складених тестів
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Всього записів: {history.length}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
              <Award className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Історія активностей порожня</p>
              <Link
                href={`/learn?tenant=${encodeURIComponent(user.tenantSubdomain)}`}
                className="inline-block px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
              >
                Почати навчання →
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-xs text-slate-400 font-mono w-4 text-center">
                      {idx + 1}
                    </span>

                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.activityType === "quiz"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      }`}
                    >
                      {item.activityType === "quiz" ? (
                        <FileQuestion className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="capitalize font-medium">
                          {item.activityType === "quiz" ? "Тестування" : "Урок курсу"}
                        </span>
                        <span>•</span>
                        <span>{new Date(item.completedAt).toLocaleString("uk-UA")}</span>
                        {item.activityType === "quiz" && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-emerald-600">
                              Результат: {item.score}%
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {item.pointsAwarded > 0 ? (
                      <span className="px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm">
                        <Sparkles className="h-3 w-3 text-amber-600 fill-amber-500" />
                        +{item.pointsAwarded} б.
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">
                        0 б. (повторно)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SpotifyShell>
  );
}
