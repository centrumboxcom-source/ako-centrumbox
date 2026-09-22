"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  Trophy,
  Award,
  ChevronRight,
  Shield,
  Layers,
  Database,
  Building2,
  Users,
  Clock,
  Plus,
  ArrowRight,
  RefreshCw,
  Search,
  Check,
  FileQuestion,
  Play,
  TrendingUp,
  GraduationCap,
  Calendar,
  Server,
  LogIn,
} from "lucide-react";
import { SpotifyShell } from "@/components/navigation/SpotifyShell";

interface Course {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
}

interface LessonItem {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  order: number;
  points: number;
  isCompleted?: boolean;
}

interface QuizItem {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description: string | null;
  passingScore: number;
  rewardPoints: number;
  passed?: boolean;
  score?: number;
}

interface LeaderUser {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">Завантаження CENTRUMBOX AKO...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [resolvedTenant, setResolvedTenant] = useState<string>("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [lessonsList, setLessonsList] = useState<LessonItem[]>([]);
  const [quizzesList, setQuizzesList] = useState<QuizItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"learning" | "architecture">("learning");

  // Multi-tenant provisioning state
  const [tenants, setTenants] = useState<any[]>([]);
  const [newTenantName, setNewTenantName] = useState("");
  const [newSubdomain, setNewSubdomain] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Доброго ранку";
    if (hour >= 12 && hour < 18) return "Доброго дня";
    return "Доброго вечора";
  };

  const loadAllData = useCallback(async (tenant: string, user: any) => {
    if (!tenant || tenant === "master") return;
    setLoading(true);
    try {
      // 1. Profile & user points
      const profileRes = await fetch(`/api/profile?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
        cache: "no-store",
      });
      const profileData = await profileRes.json();
      if (profileData.success && profileData.data?.user) {
        setCurrentUser(profileData.data.user);
      }

      // 2. Courses
      const coursesRes = await fetch(`/api/courses?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
        cache: "no-store",
      });
      const coursesData = await coursesRes.json();
      const loadedCourses: Course[] = coursesData.success ? coursesData.data || [] : [];
      setCourses(loadedCourses);

      // 3. Fetch lessons and quizzes for each course to build home cards
      const allLessons: LessonItem[] = [];
      const allQuizzes: QuizItem[] = [];

      for (const c of loadedCourses) {
        // Lessons
        const lRes = await fetch(`/api/courses/${c.id}/lessons?tenant=${encodeURIComponent(tenant)}`, {
          headers: { "x-tenant-override": tenant },
          cache: "no-store",
        });
        const lData = await lRes.json();
        if (lData.success && lData.data) {
          lData.data.forEach((l: any) => {
            allLessons.push({
              id: l.id,
              courseId: c.id,
              courseTitle: c.title,
              title: l.title,
              order: l.order,
              points: l.points || 10,
              isCompleted: true,
            });
          });
        }

        // Quizzes
        const qRes = await fetch(`/api/courses/${c.id}/quizzes?tenant=${encodeURIComponent(tenant)}`, {
          headers: { "x-tenant-override": tenant },
          cache: "no-store",
        });
        const qData = await qRes.json();
        if (qData.success && qData.data) {
          qData.data.forEach((q: any) => {
            allQuizzes.push({
              id: q.id,
              courseId: c.id,
              courseTitle: c.title,
              title: q.title,
              description: q.description,
              passingScore: q.passingScore,
              rewardPoints: q.rewardPoints,
              passed: true,
              score: 100,
            });
          });
        }
      }

      setLessonsList(allLessons);
      setQuizzesList(allQuizzes);

      // 4. Leaderboard
      const leaderboardRes = await fetch(`/api/leaderboard?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
        cache: "no-store",
      });
      const leaderboardData = await leaderboardRes.json();
      if (leaderboardData.success && leaderboardData.data) {
        setLeaderboard(leaderboardData.data);
      }

      // 5. Tenants list (for admin control plane)
      if (user?.role === "admin") {
        const tenantsRes = await fetch("/api/admin/tenants", { cache: "no-store" });
        const tenantsData = await tenantsRes.json();
        if (tenantsData.success && tenantsData.tenants) {
          setTenants(tenantsData.tenants);
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Strict Authentication Check on Mount
  useEffect(() => {
    async function verifyAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();

        if (!data.authenticated || !data.user) {
          // Unauthenticated -> immediately redirect to /login
          window.location.replace("/login");
          return;
        }

        const user = data.user;
        if (user.tenantSubdomain === "master") {
          // Platform SuperAdmin -> immediately redirect to /superadmin
          window.location.replace("/superadmin");
          return;
        }

        const explicitTenant = searchParams.get("tenant") || searchParams.get("__tenant");
        const tenant = explicitTenant || user.tenantSubdomain;

        setCurrentUser(user);
        setResolvedTenant(tenant);
        setCheckingAuth(false);
        loadAllData(tenant, user);
      } catch {
        window.location.replace("/login");
      }
    }

    verifyAuth();
  }, [searchParams, loadAllData]);

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName || !newSubdomain) return;
    setProvisioning(true);
    setProvisionMessage(null);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTenantName,
          subdomain: newSubdomain.toLowerCase().trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProvisionMessage(`Організацію "${newTenantName}" успішно зареєстровано в Neon!`);
        setNewTenantName("");
        setNewSubdomain("");
        if (resolvedTenant && currentUser) {
          loadAllData(resolvedTenant, currentUser);
        }
      } else {
        setProvisionMessage(data.error || "Помилка створення організації");
      }
    } catch {
      setProvisionMessage("Мережева помилка");
    } finally {
      setProvisioning(false);
    }
  };

  if (checkingAuth || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="text-xs text-slate-500 font-medium">Перевірка авторизації CENTRUMBOX AKO...</span>
      </div>
    );
  }

  return (
    <SpotifyShell currentTenant={resolvedTenant}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Top Control Bar: Mode Toggle & Tenant Schema Badge (Visible ONLY to Admin) */}
        {currentUser?.role === "admin" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("learning")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "learning"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Навчальний хаб співробітника</span>
              </button>

              {currentUser?.role === "admin" && (
                <button
                  onClick={() => setActiveTab("architecture")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === "architecture"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span>Multi-Tenant Архітектура</span>
                </button>
              )}

              {currentUser?.role === "admin" && (
                <Link
                  href="/superadmin"
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                >
                  <Server className="h-4 w-4 text-indigo-600" />
                  <span>Консоль Супер-Адміна ⚡</span>
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <span>Активна схема PostgreSQL:</span>
              <strong className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                "{resolvedTenant}"
              </strong>
            </div>
          </div>
        )}

        {activeTab === "learning" || currentUser?.role !== "admin" ? (
          <>
            {/* Hero Welcome Banner */}
            <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-500/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-indigo-100">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    CENTRUMBOX AKO • {resolvedTenant.toUpperCase()} ACADEMY
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                    {getGreeting()}, {currentUser.name}!
                  </h1>
                  <p className="text-sm sm:text-base text-indigo-100 max-w-xl">
                    Усі ваші призначені уроки, практичні модулі та контрольні тестування зібрано нижче.
                  </p>
                </div>

                {/* Points Summary Badge */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center gap-4 shrink-0 shadow-sm">
                  <div className="h-12 w-12 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-black text-xl shadow-md">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <span className="text-[11px] text-indigo-200 uppercase tracking-wider font-semibold block">
                      Ваш поточний прогрес
                    </span>
                    <span className="text-sm font-black text-white block">
                      {currentUser.rank?.title || "Спеціаліст"}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
                        {currentUser.points ?? 0} балів
                      </span>
                      <Link
                        href={`/profile?tenant=${encodeURIComponent(resolvedTenant)}`}
                        className="text-xs text-white underline hover:text-indigo-200 transition font-semibold"
                      >
                        Мій кабінет →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: LESSON CARDS (Картки уроків на головній) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-600" />
                    Картки навчальних модулів та уроків
                  </h2>
                  <p className="text-xs text-slate-500">
                    Натисніть на картку уроку, щоб перейти до вивчення матеріалу або повторити його
                  </p>
                </div>

                <Link
                  href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Усі матеріали курсу →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lessonsList.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="ako-card p-5 rounded-2xl flex flex-col justify-between space-y-4 group hover:border-indigo-300"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                          Урок {lesson.order}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Завершено (+{lesson.points} б.)
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                        {lesson.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        Курс: {lesson.courseTitle}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Інтерактивний модуль</span>
                      <Link
                        href={`/learn?tenant=${encodeURIComponent(activeTenant)}&course=${lesson.courseId}&lesson=${lesson.id}`}
                        className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                      >
                        Відкрити урок →
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Quizzes Cards on Home */}
                {quizzesList.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="ako-card p-5 rounded-2xl flex flex-col justify-between space-y-4 border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <FileQuestion className="h-3 w-3" />
                          Атестація
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          Складено на 100% (+{quiz.rewardPoints} б.)
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                        {quiz.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {quiz.description || "Контрольне тестування знань з автоматичним підрахунком результату."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-amber-100 flex items-center justify-between text-xs">
                      <span className="text-amber-800 font-semibold font-mono">Прохідний бал: {quiz.passingScore}%</span>
                      <Link
                        href={`/learn?tenant=${encodeURIComponent(activeTenant)}&course=${quiz.courseId}&quiz=${quiz.id}`}
                        className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                      >
                        Переглянути тест →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: COURSES OVERVIEW CARDS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    Призначені навчальні програми
                  </h2>
                  <p className="text-xs text-slate-500">
                    Повні навчальні курси, призначені для вашої ролі в організації {activeTenant}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="ako-card p-6 rounded-2xl flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          АКТИВНИЙ КУРС
                        </span>
                        <span className="text-xs font-mono font-bold text-indigo-600">
                          2 модулі • 1 тест
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2">
                        {course.description || "Комплексний навчальний курс для нових інженерів компанії."}
                      </p>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                          <span>Прогрес проходження</span>
                          <span className="font-mono text-emerald-600 font-bold">100%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full w-full" />
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/learn?tenant=${encodeURIComponent(activeTenant)}&course=${course.id}`}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" />
                      <span>Відкрити навчання курсу</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 3: LEADERBOARD WIDGET */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 ako-card p-6 sm:p-8 rounded-3xl space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      Рейтинг активності та балів працівників
                    </h3>
                    <p className="text-xs text-slate-500">
                      Співробітники організації з найбільшою кількістю зароблених балів
                    </p>
                  </div>
                  {currentUser ? (
                    <Link
                      href={`/profile?tenant=${encodeURIComponent(activeTenant)}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Мій ранг ({currentUser.points ?? 0} б.) →
                    </Link>
                  ) : (
                    <Link
                      href={`/login?tenant=${encodeURIComponent(activeTenant)}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Увійти в акаунт →
                    </Link>
                  )}
                </div>

                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((u, idx) => (
                    <div
                      key={u.id}
                      className={`p-3.5 rounded-2xl flex items-center justify-between gap-4 transition ${
                        u.email === currentUser?.email
                          ? "bg-indigo-50/80 border border-indigo-200"
                          : "bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <span
                          className={`h-7 w-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0
                              ? "bg-amber-400 text-slate-900 shadow-sm"
                              : idx === 1
                              ? "bg-slate-300 text-slate-900 shadow-sm"
                              : idx === 2
                              ? "bg-amber-700 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {u.name}
                            </h4>
                            {u.email === currentUser?.email && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                                Ви
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                          {u.points || 0} балів
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Navigation Hub */}
              <div className="lg:col-span-4 ako-card p-6 sm:p-8 rounded-3xl space-y-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Швидкий доступ
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Кабінети платформи</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Миттєвий перехід до персональних або управлінських розділів CENTRUMBOX AKO.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Link
                    href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 text-slate-800 hover:text-indigo-700 text-xs font-bold transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <span>Каталог курсів & Уроків</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    href={`/profile?tenant=${encodeURIComponent(activeTenant)}`}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-200 text-slate-800 hover:text-amber-800 text-xs font-bold transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span>Особистий кабінет & Бали</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  {currentUser?.role === "admin" || currentUser?.role === "instructor" ? (
                    <Link
                      href={`/admin?tenant=${encodeURIComponent(activeTenant)}`}
                      className="w-full p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-bold transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Layers className="h-4 w-4" />
                        <span>HR Студія & Конструктор</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ) : (
                    <Link
                      href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
                      className="w-full p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-bold transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <GraduationCap className="h-4 w-4" />
                        <span>Мій навчальний прогрес</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500">
                  Організація: <strong className="text-slate-800 font-mono">{activeTenant}</strong>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Multi-Tenant Control Plane Tab */
          <div className="space-y-6">
            <div className="ako-card p-6 sm:p-8 rounded-3xl space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 mb-1">
                  <Database className="h-4 w-4" />
                  PostgreSQL Schema-per-Tenant
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Керування клієнтськими схемами бази даних
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Кожен корпоративний клієнт отримує окрему схему в базі даних Neon PostgreSQL.
                </p>
              </div>

              {/* Provisioning Form */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-indigo-600" />
                  Створити нову організацію (Tenant Схему)
                </h3>

                {provisionMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                    {provisionMessage}
                  </div>
                )}

                <form onSubmit={handleProvisionTenant} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Назва компанії (напр. Tesla Inc)"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Сабдомен (напр. tesla)"
                    value={newSubdomain}
                    onChange={(e) => setNewSubdomain(e.target.value)}
                    className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={provisioning}
                    className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {provisioning ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    <span>Створити схему клієнта</span>
                  </button>
                </form>
              </div>

              {/* Tenants List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Зареєстровані компанії</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {tenants.map((t) => (
                    <div
                      key={t.subdomain}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                        activeTenant === t.subdomain
                          ? "bg-indigo-50/70 border-indigo-300 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                        <span className="text-[11px] font-mono text-indigo-600">
                          schema: "{t.subdomain}"
                        </span>
                      </div>
                      <Link
                        href={`/?tenant=${t.subdomain}`}
                        className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                      >
                        Обрати
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Platform Footer with Superadmin Link */}
        <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">CENTRUMBOX AKO</span>
            <span>•</span>
            <span>Multi-Tenant Corporate Learning Platform</span>
          </div>

          {currentUser?.role === "admin" && (
            <Link
              href="/superadmin"
              className="text-slate-500 hover:text-indigo-600 transition flex items-center gap-1.5 font-medium"
            >
              <Server className="h-3.5 w-3.5 text-slate-400" />
              <span>Панель Головного Адміністратора Системи (Superadmin) →</span>
            </Link>
          )}
        </div>
      </div>
    </SpotifyShell>
  );
}
