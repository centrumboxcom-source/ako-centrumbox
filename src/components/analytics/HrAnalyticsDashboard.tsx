"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Award,
  TrendingUp,
  Clock,
  Search,
  Download,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Layers,
  FileQuestion,
  Filter,
  Check,
  X,
  Star,
  Activity,
} from "lucide-react";

interface HrAnalyticsDashboardProps {
  tenantSubdomain: string;
}

interface CourseOption {
  id: string;
  title: string;
}

interface CourseQuizAttempt {
  quizId: string;
  quizTitle: string;
  passingScore: number;
  attempt: {
    score: number;
    passed: boolean;
    completedAt: string;
  } | null;
}

interface EmployeeCourseProgress {
  courseId: string;
  courseTitle: string;
  isPublished: boolean;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  isCompleted: boolean;
  quizzes: CourseQuizAttempt[];
}

interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  lastLoginAt: string | null;
  createdAt: string;
  courses: EmployeeCourseProgress[];
}

interface AnalyticsData {
  summary: {
    totalEmployees: number;
    activeEmployeesCount: number;
    totalCourses: number;
    avgCompletionRate: number;
    avgQuizScore: number;
    quizPassRate: number;
    totalPointsAwarded: number;
  };
  courses: CourseOption[];
  employees: EmployeeRecord[];
}

export default function HrAnalyticsDashboard({ tenantSubdomain }: HrAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        headers: { "x-tenant-override": tenantSubdomain },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Помилка завантаження аналітики:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantSubdomain]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Format friendly date
  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return "Ще не входив";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Щойно активний";
    if (diffHours < 24) return `Сьогодні (${diffHours} год тому)`;
    if (diffDays === 1) return "Вчора";
    if (diffDays < 7) return `${diffDays} дн. тому`;

    return date.toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!data) return;

    let csvContent = "";
    // Header
    const courseTitles = data.courses.map((c) => `"${c.title} (Лекції)","${c.title} (Тест %)"`).join(",");
    csvContent = `ПІБ,Email,Роль,Бали,Останній вхід,${courseTitles}\n`;

    data.employees.forEach((emp) => {
      const courseColumns = data.courses
        .map((c) => {
          const cp = emp.courses.find((x) => x.courseId === c.id);
          const lessonProgress = cp ? `"${cp.completedLessons}/${cp.totalLessons} (${cp.progressPercent}%)"` : '"-"';
          const quizResult =
            cp && cp.quizzes.length > 0
              ? cp.quizzes.map((q) => (q.attempt ? `${q.attempt.score}% (${q.attempt.passed ? "Складено" : "Не складено"})` : "Не складав")).join(" | ")
              : "Немає тестів";
          return `${lessonProgress},"${quizResult}"`;
        })
        .join(",");

      const lastLogin = emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleString("uk-UA") : "Не зафіксовано";

      csvContent += `"${emp.name}","${emp.email}","${emp.role}",${emp.points},"${lastLogin}",${courseColumns}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `звіт_успішності_${tenantSubdomain}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
        Завантаження аналітики та показників успішності...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center border border-slate-200 rounded-3xl bg-slate-50/70 text-slate-500 text-xs">
        Не вдалося завантажити аналітичні дані компанії.
      </div>
    );
  }

  // Filter employees
  const filteredEmployees = data.employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCourseFilter !== "all") {
      const cp = emp.courses.find((x) => x.courseId === selectedCourseFilter);
      return cp && (cp.completedLessons > 0 || cp.quizzes.some((q) => q.attempt !== null));
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
            Всього працівників
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {data.summary.totalEmployees}
            </span>
            <Users className="h-5 w-5 text-indigo-600 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-400">У схемі "{tenantSubdomain}"</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
            Активні за 30 днів
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {data.summary.activeEmployeesCount}
            </span>
            <Activity className="h-5 w-5 text-emerald-600 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-400">
            {Math.round(
              (data.summary.activeEmployeesCount / Math.max(data.summary.totalEmployees, 1)) * 100
            )}
            % активності команди
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
            Сер. прогрес курсів
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-indigo-600">
              {data.summary.avgCompletionRate}%
            </span>
            <TrendingUp className="h-5 w-5 text-indigo-600 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-400">Завершення матеріалів</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
            Сер. бал тестувань
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-purple-600">
              {data.summary.avgQuizScore}%
            </span>
            <Award className="h-5 w-5 text-purple-600 shrink-0" />
          </div>
          <span className="text-[11px] text-slate-400">
            {data.summary.quizPassRate}% успішних здач
          </span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 block">
            Нараховані бали ⭐
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">
              {data.summary.totalPointsAwarded}
            </span>
            <Star className="h-5 w-5 text-amber-500 shrink-0 fill-amber-400" />
          </div>
          <span className="text-[11px] text-amber-700/80">Гейміфікація компанії</span>
        </div>
      </div>

      {/* 2. CONTROLS: SEARCH, FILTER, EXPORT */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Зведена таблиця успішності та активності співробітників
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Моніторинг проходження лекцій, складання тестів та останнього входу працівників.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200"
              title="Завантажити звіт у форматі CSV"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" />
              Експортувати звіт (CSV)
            </button>

            <button
              onClick={loadAnalytics}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition border border-slate-200"
              title="Оновити дані"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-7 relative">
            <input
              type="text"
              placeholder="Пошук за ім'ям, email або роллю працівника..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="sm:col-span-5 relative">
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 appearance-none"
            >
              <option value="all">Усі навчальні курси компанії</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  Курс: {c.title}
                </option>
              ))}
            </select>
            <Filter className="h-3.5 w-3.5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* 3. EMPLOYEE TABLE */}
        {filteredEmployees.length === 0 ? (
          <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/70 space-y-2">
            <Users className="h-8 w-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500">Співробітників за вказаними фільтрами не знайдено.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-3.5">Працівник</th>
                    <th className="p-3.5">Роль</th>
                    <th className="p-3.5">Останній вхід</th>
                    {selectedCourseFilter === "all" ? (
                      <th className="p-3.5">Успішність по курсах</th>
                    ) : (
                      <>
                        <th className="p-3.5">Пройдено лекцій</th>
                        <th className="p-3.5">Результат тесту</th>
                      </>
                    )}
                    <th className="p-3.5">Бали ⭐</th>
                    <th className="p-3.5 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const selectedCourseProgress =
                      selectedCourseFilter !== "all"
                        ? emp.courses.find((c) => c.courseId === selectedCourseFilter)
                        : null;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                        {/* Employee Name & Email */}
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{emp.email}</div>
                        </td>

                        {/* Role */}
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              emp.role === "admin"
                                ? "bg-purple-50 border-purple-200 text-purple-700"
                                : emp.role === "instructor"
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            {emp.role}
                          </span>
                        </td>

                        {/* Last Login / Active */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{formatLastActive(emp.lastLoginAt)}</span>
                          </div>
                        </td>

                        {/* Course Progress Columns */}
                        {selectedCourseFilter === "all" ? (
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {emp.courses.length === 0 ? (
                                <span className="text-slate-400 text-[11px]">Курсів немає</span>
                              ) : (
                                emp.courses.map((cp) => (
                                  <span
                                    key={cp.courseId}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border flex items-center gap-1 ${
                                      cp.isCompleted
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : cp.completedLessons > 0
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                        : "bg-slate-100 border-slate-200 text-slate-600"
                                    }`}
                                    title={`${cp.courseTitle}: ${cp.completedLessons}/${cp.totalLessons} уроків (${cp.progressPercent}%)`}
                                  >
                                    {cp.courseTitle.slice(0, 16)}...: {cp.progressPercent}%
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="p-3.5">
                              {selectedCourseProgress ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-900 font-semibold">
                                      {selectedCourseProgress.completedLessons} /{" "}
                                      {selectedCourseProgress.totalLessons}
                                    </span>
                                    <span className="text-[11px] text-indigo-600 font-bold">
                                      ({selectedCourseProgress.progressPercent}%)
                                    </span>
                                  </div>
                                  <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        selectedCourseProgress.isCompleted
                                          ? "bg-emerald-500"
                                          : "bg-indigo-600"
                                      }`}
                                      style={{ width: `${selectedCourseProgress.progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="p-3.5">
                              {selectedCourseProgress?.quizzes && selectedCourseProgress.quizzes.length > 0 ? (
                                <div className="space-y-1">
                                  {selectedCourseProgress.quizzes.map((q) => (
                                    <div key={q.quizId}>
                                      {q.attempt ? (
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            q.attempt.passed
                                              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                              : "bg-rose-50 border border-rose-200 text-rose-700"
                                          }`}
                                        >
                                          {q.attempt.score}%{" "}
                                          {q.attempt.passed ? "Складено" : "Не складено"}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">
                                          Не проходив (Поріг: {q.passingScore}%)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Без тестування</span>
                              )}
                            </td>
                          </>
                        )}

                        {/* Points */}
                        <td className="p-3.5 font-bold text-amber-600 font-mono">
                          ⭐ {emp.points}
                        </td>

                        {/* Detail Modal Action */}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedEmployee(emp)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
                          >
                            Деталі →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. DETAIL MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Індивідуальна картка працівника
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Детальна інформація про проходження курсів та результати тестувань
                </p>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Працівник:</span>
                <span className="font-semibold text-slate-900">{selectedEmployee.name}</span>
                <span className="text-[11px] text-slate-500 block font-mono truncate">
                  {selectedEmployee.email}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Роль:</span>
                <span className="font-bold text-indigo-600 uppercase">{selectedEmployee.role}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Баланс балів:</span>
                <span className="font-bold text-amber-600">⭐ {selectedEmployee.points}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Останній вхід:</span>
                <span className="text-slate-700 font-medium">
                  {formatLastActive(selectedEmployee.lastLoginAt)}
                </span>
              </div>
            </div>

            {/* Courses Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Прогрес по навчальних програмах ({selectedEmployee.courses.length}):
              </h4>

              {selectedEmployee.courses.length === 0 ? (
                <p className="text-xs text-slate-500">У компанії ще немає створених курсів.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEmployee.courses.map((c) => (
                    <div
                      key={c.courseId}
                      className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{c.courseTitle}</span>
                        {c.isCompleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Завершено
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-600">
                            {c.progressPercent}% пройдено
                          </span>
                        )}
                      </div>

                      {/* Progress line */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            Уроки: {c.completedLessons} з {c.totalLessons}
                          </span>
                          <span className="font-mono text-indigo-600 font-semibold">
                            {c.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.isCompleted ? "bg-emerald-500" : "bg-indigo-600"
                            }`}
                            style={{ width: `${c.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Quizzes breakdown */}
                      {c.quizzes.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            Тестування:
                          </span>
                          {c.quizzes.map((q) => (
                            <div
                              key={q.quizId}
                              className="flex items-center justify-between text-xs bg-white border border-slate-200 p-2 rounded-xl"
                            >
                              <span className="text-slate-800">{q.quizTitle}</span>
                              {q.attempt ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    q.attempt.passed
                                      ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                      : "bg-rose-50 border border-rose-200 text-rose-700"
                                  }`}
                                >
                                  {q.attempt.score}% (Поріг: {q.passingScore}%)
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">
                                  Не складав (Поріг: {q.passingScore}%)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
