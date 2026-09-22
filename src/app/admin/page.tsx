"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  BookOpen,
  Plus,
  LogOut,
  Building2,
  CheckCircle2,
  RefreshCw,
  Mail,
  UserCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Layers,
  Globe,
  Trash2,
  Edit,
  ExternalLink,
  AlertCircle,
  FileCode,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { Course } from "@/db/schema/tenant";
import InviteManager from "@/components/admin/InviteManager";
import HrAnalyticsDashboard from "@/components/analytics/HrAnalyticsDashboard";
import { SpotifyShell } from "@/components/navigation/SpotifyShell";

interface CurrentUser {
  email: string;
  name: string;
  role: string;
  tenantSubdomain: string;
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Main navigation tab
  const [adminTab, setAdminTab] = useState<"courses" | "analytics" | "onboarding" | "manual">(
    (searchParams?.get("tab") as any) || "courses"
  );

  // Courses state
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCoursePublished, setNewCoursePublished] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Employees form state
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("password123");
  const [newEmpRole, setNewEmpRole] = useState<"student" | "instructor" | "admin">("student");
  const [creatingEmp, setCreatingEmp] = useState(false);

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [empMessage, setEmpMessage] = useState<string | null>(null);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);

  // Check auth session and role
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          if (data.user.role !== "admin" && data.user.role !== "instructor") {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
          setCurrentUser(data.user);
        } else {
          router.push("/login?error=unauthorized");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Load tenant courses
  const loadCourses = useCallback(async (tenant: string) => {
    setCoursesLoading(true);
    try {
      const res = await fetch(`/api/courses?tenant=${encodeURIComponent(tenant)}`, {
        headers: { "x-tenant-override": tenant },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCourses(data.data || []);
      }
    } catch (e) {
      console.error("Помилка завантаження курсів:", e);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.tenantSubdomain) {
      loadCourses(currentUser.tenantSubdomain);
    }
  }, [currentUser, loadCourses]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  // Create new course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newCourseTitle.trim()) return;

    setCreatingCourse(true);
    setCourseMessage(null);

    try {
      const res = await fetch(`/api/courses?tenant=${encodeURIComponent(currentUser.tenantSubdomain)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-override": currentUser.tenantSubdomain,
        },
        body: JSON.stringify({
          title: newCourseTitle.trim(),
          description: newCourseDesc.trim() || null,
          isPublished: newCoursePublished,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося створити курс");
      }

      const created = data.data as Course;
      setCourses((prev) => [created, ...prev]);
      setShowNewCourseModal(false);
      setNewCourseTitle("");
      setNewCourseDesc("");
      setNewCoursePublished(false);

      // Redirect directly to course builder
      router.push(`/admin/courses/${created.id}/builder?tenant=${currentUser.tenantSubdomain}`);
    } catch (err: any) {
      setCourseMessage(err.message || "Помилка створення курсу");
    } finally {
      setCreatingCourse(false);
    }
  };

  // Toggle publish
  const handleToggleCoursePublish = async (course: Course) => {
    if (!currentUser) return;
    const nextStatus = !course.isPublished;

    try {
      const res = await fetch(`/api/courses/${course.id}?tenant=${encodeURIComponent(currentUser.tenantSubdomain)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-override": currentUser.tenantSubdomain,
        },
        body: JSON.stringify({ isPublished: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCourses((prev) =>
          prev.map((c) => (c.id === course.id ? { ...c, isPublished: nextStatus } : c))
        );
      }
    } catch (e) {
      console.error("Помилка перемикання статусу:", e);
    }
  };

  // Delete course
  const handleDeleteCourse = async (courseId: string, title: string) => {
    if (!currentUser) return;
    if (!confirm(`Ви впевнені, що бажаєте видалити курс "${title}" разом з усіма його уроками?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/${courseId}?tenant=${encodeURIComponent(currentUser.tenantSubdomain)}`, {
        method: "DELETE",
        headers: {
          "x-tenant-override": currentUser.tenantSubdomain,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
      }
    } catch (e) {
      console.error("Помилка видалення курсу:", e);
    }
  };

  // Register Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newEmpEmail || !newEmpName) return;

    setCreatingEmp(true);
    setEmpMessage(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmpName,
          email: newEmpEmail,
          password: newEmpPassword,
          role: newEmpRole,
          subdomain: currentUser.tenantSubdomain,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmpMessage(`Працівника ${newEmpEmail} успішно зареєстровано з роллю '${newEmpRole}'!`);
        setNewEmpName("");
        setNewEmpEmail("");
      } else {
        setEmpMessage(data.error || "Не вдалося зареєструвати");
      }
    } catch (err) {
      setEmpMessage(err instanceof Error ? err.message : "Помилка мережі");
    } finally {
      setCreatingEmp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
        Перевірка прав доступу...
      </div>
    );
  }

  if (accessDenied) {
    return (
      <SpotifyShell currentTenant={currentUser?.tenantSubdomain}>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="h-16 w-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              Помилка 403 • Доступ обмежено
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Розділ доступний лише для HR та Адміністраторів
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Ваш обліковий запис має роль <strong>Студент</strong>. Створення курсів, керування працівниками та корпоративна аналітика доступні виключно менеджменту компанії.
            </p>
          </div>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              ← На головну
            </Link>
            <Link
              href="/learn"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              До мого навчання
            </Link>
          </div>
        </div>
      </SpotifyShell>
    );
  }

  return (
    <SpotifyShell currentTenant={currentUser?.tenantSubdomain}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Creator Studio Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                CENTRUMBOX AKO • HR СТУДІЯ
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Схема: "{currentUser?.tenantSubdomain}"
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              HR & Панель Створення Курсів
            </h1>
          </div>

          <button
            onClick={() => setShowNewCourseModal(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Створити новий курс</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 w-fit">
          <button
            onClick={() => setAdminTab("courses")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              adminTab === "courses"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Навчальні курси ({courses.length})</span>
          </button>

          <button
            onClick={() => setAdminTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              adminTab === "analytics"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Аналітика успішності</span>
          </button>

          <button
            onClick={() => setAdminTab("onboarding")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              adminTab === "onboarding"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Онбординг (Інвайти & CSV)</span>
          </button>

          <button
            onClick={() => setAdminTab("manual")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              adminTab === "manual"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Ручне додавання & RBAC</span>
          </button>
        </div>

        {/* Tab 1: COURSES SECTION */}
        {adminTab === "courses" && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Управління навчальними курсами</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Створюйте навчальні програми, редагуйте уроки через візуальний конструктор та впорядковуйте матеріали.
                </p>
              </div>

              <button
                onClick={() => setShowNewCourseModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Створити новий курс
              </button>
            </div>

            {/* Courses List */}
            {coursesLoading ? (
              <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                Завантаження курсів компанії...
              </div>
            ) : courses.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/70">
                <BookOpen className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-900 mb-1">У компанії ще немає створених курсів</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Створіть свій перший курс і наповніть його інтерактивними лекціями, відео та кодом.
                </p>
                <button
                  onClick={() => setShowNewCourseModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
                >
                  + Створити курс зараз
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="group p-5 rounded-2xl bg-slate-50/60 hover:bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleToggleCoursePublish(course)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition ${
                            course.isPublished
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          }`}
                          title="Натисніть для зміни статусу публікації"
                        >
                          {course.isPublished ? (
                            <>
                              <Globe className="h-3 w-3" /> Опубліковано
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Чернетка
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteCourse(course.id, course.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Видалити курс"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed min-h-[32px]">
                          {course.description || "Опис курсу відсутній."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-150 flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/courses/${course.id}/builder?tenant=${currentUser?.tenantSubdomain}`}
                        className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Конструктор уроків
                      </Link>

                      <Link
                        href={`/learn?tenant=${currentUser?.tenantSubdomain}&course=${course.id}`}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200"
                        title="Переглянути від імені студента"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: ANALYTICS DASHBOARD */}
        {adminTab === "analytics" && (
          <HrAnalyticsDashboard tenantSubdomain={currentUser?.tenantSubdomain || ""} />
        )}

        {/* Tab 3: ONBOARDING & INVITES SECTION */}
        {adminTab === "onboarding" && (
          <InviteManager tenantSubdomain={currentUser?.tenantSubdomain || ""} />
        )}

        {/* Tab 4: MANUAL ADD & RBAC INFO */}
        {adminTab === "manual" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Add Employee Form */}
            <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Додати працівника вручну</h2>
                  <p className="text-xs text-slate-500">Пряма реєстрація користувача в схемі "{currentUser?.tenantSubdomain}"</p>
                </div>
              </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ПІБ Працівника</label>
                <input
                  type="text"
                  placeholder="Олена Ковальчук"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Корпоративний Email</label>
                <input
                  type="email"
                  placeholder="olena@company.ua"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Тимчасовий пароль</label>
                <input
                  type="text"
                  value={newEmpPassword}
                  onChange={(e) => setNewEmpPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Призначити роль (RBAC)</label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="student">
                    Employee / Студент (Доступ лише до /learn)
                  </option>
                  <option value="instructor">
                    Інструктор (Створення курсів)
                  </option>
                  <option value="admin">
                    HR / Org Admin (Повний доступ до /admin)
                  </option>
                </select>
              </div>

              {empMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{empMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={creatingEmp}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
              >
                {creatingEmp ? "Збереження в схемі..." : "Зареєструвати працівника"}
              </button>
            </form>
          </div>

          {/* RBAC Info */}
          <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Статус захисту роуту /admin (RBAC)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Цей маршрут захищено у <code className="text-indigo-600 font-mono bg-indigo-50 px-1.5 py-0.5 rounded">middleware.ts</code>. Якщо працівник із роллю
              <code className="text-emerald-700 font-mono mx-1 bg-emerald-50 px-1.5 py-0.5 rounded">student</code> спробує відкрити це посилання, Middleware автоматично
              перенаправить його на <code className="text-indigo-600 font-mono bg-indigo-50 px-1.5 py-0.5 rounded">/learn</code> через брак прав.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">Ваша активна сесія:</span>
                <span className="text-emerald-700 font-medium font-mono">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">Роль:</span>
                <span className="bg-indigo-100 text-indigo-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                  {currentUser?.role.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Дозволені ролі для /admin:</span>
                <span className="text-slate-700 font-mono text-[11px]">["admin"]</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs">
              <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
                ← До головного дашборду
              </Link>
              <button
                onClick={handleLogout}
                className="text-rose-600 hover:text-rose-700 font-medium"
              >
                Вийти із системи
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* CREATE COURSE MODAL */}
      {showNewCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Створення нового курсу</h3>
              </div>
              <button
                onClick={() => setShowNewCourseModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {courseMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{courseMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Назва курсу *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Наприклад: Вступ до безпеки праці та IT-гігієни"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Опис курсу
                </label>
                <textarea
                  rows={3}
                  placeholder="Короткий зміст курсу, для кого призначений..."
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pubCheckbox"
                  checked={newCoursePublished}
                  onChange={(e) => setNewCoursePublished(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-100 border-slate-300 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="pubCheckbox" className="text-xs text-slate-600 cursor-pointer select-none">
                  Опублікувати відразу (буде видимий для студентів у /learn)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCourseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse || !newCourseTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-600/30"
                >
                  {creatingCourse ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Створення...
                    </>
                  ) : (
                    "Створити та відкрити конструктор →"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SpotifyShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-slate-500 p-8">Завантаження панелі адміністратора...</div>}>
      <AdminContent />
    </Suspense>
  );
}
