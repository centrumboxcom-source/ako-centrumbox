"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  Building2,
  Database,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Server,
  Lock,
  UserCheck,
  Sparkles,
  ArrowLeft,
  Users,
  BookOpen,
  Box,
} from "lucide-react";
import { SpotifyShell } from "@/components/navigation/SpotifyShell";

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  createdAt: string;
}

function SuperadminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [fetchingTenants, setFetchingTenants] = useState(false);

  // New tenant form
  const [newTenantName, setNewTenantName] = useState("");
  const [newSubdomain, setNewSubdomain] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Check auth session
  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === "admin") {
          loadTenants();
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    setFetchingTenants(true);
    try {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      if (data.success && data.tenants) {
        setTenants(data.tenants);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingTenants(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleSwitchToTenantAsAdmin = (subdomain: string) => {
    router.push(`/?tenant=${encodeURIComponent(subdomain)}`);
  };

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || !newSubdomain.trim()) return;

    setProvisioning(true);
    setProvisionResult(null);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTenantName.trim(),
          subdomain: newSubdomain.trim().toLowerCase(),
          adminEmail: newAdminEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setProvisionResult({
          success: true,
          message: `Організацію "${newTenantName}" успішно створено! Клієнтську схему "${newSubdomain.toLowerCase()}" розгорнуто в Neon PostgreSQL.`,
        });
        setNewTenantName("");
        setNewSubdomain("");
        setNewAdminEmail("");
        loadTenants();
      } else {
        setProvisionResult({
          success: false,
          message: data.error || "Не вдалося створити організацію",
        });
      }
    } catch (err: any) {
      setProvisionResult({
        success: false,
        message: err.message || "Помилка мережі при створенні тенанта",
      });
    } finally {
      setProvisioning(false);
    }
  };

  if (loading) {
    return (
      <SpotifyShell currentTenant="acme">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-xs text-slate-500 font-medium">Перевірка прав доступу до системної консолі...</span>
        </div>
      </SpotifyShell>
    );
  }

  if (!currentUser) {
    return (
      <SpotifyShell currentTenant="acme">
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">Потрібна авторизація</h1>
            <p className="text-xs text-slate-500">
              Ця сторінка доступна лише авторизованим системним адміністраторам платформи CENTRUMBOX AKO.
            </p>
          </div>
          <Link
            href="/login?from=/superadmin"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
          >
            Увійти до системи →
          </Link>
        </div>
      </SpotifyShell>
    );
  }

  if (currentUser.role !== "admin") {
    return (
      <SpotifyShell currentTenant={currentUser?.tenantSubdomain || "acme"}>
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
          <div className="mx-auto h-20 w-20 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-sm">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              ПОМИЛКА 403 • ДОСТУП ОБМЕЖЕНО
            </span>
            <h1 className="text-2xl font-black text-slate-900 pt-1">
              Доступ до системної консолі заборонено
            </h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Цей розділ призначений виключно для Головних Адміністраторів платформи CENTRUMBOX AKO.
              Ваш акаунт (<strong>{currentUser.email}</strong>) має роль «<strong>{currentUser.role === "student" ? "Студент" : currentUser.role}</strong>» і не має повноважень керувати клієнтськими схемами бази даних.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Повернутися до мого навчання
            </Link>
          </div>
        </div>
      </SpotifyShell>
    );
  }

  return (
    <SpotifyShell currentTenant={currentUser?.tenantSubdomain || "acme"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <Link
            href="/"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            До головного дашборду CENTRUMBOX AKO
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Поточний акаунт:</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
              {currentUser?.email || "Не авторизовано"} ({currentUser?.role || "гість"})
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wider text-indigo-200 border border-white/10">
                <Box className="h-3.5 w-3.5 text-indigo-400" />
                CENTRUMBOX AKO • ПЛАТФОРМЕНА ПАНЕЛЬ КЕРУВАННЯ
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                Консоль Головного Адміністратора Системи
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Централізоване керування всіма корпоративними клієнтами, автоматичне створення ізольованих схем у хмарі Neon PostgreSQL, контроль безпеки та масштабування.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 shrink-0">
              <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Архітектура бази
                </span>
                <span className="text-sm font-bold text-white block">
                  PostgreSQL Schema-per-Tenant
                </span>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Neon Cloud Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="ako-card p-5 rounded-2xl flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Активних організацій</span>
              <h3 className="text-2xl font-black text-slate-900">{tenants.length}</h3>
            </div>
          </div>

          <div className="ako-card p-5 rounded-2xl flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Ізольованих схем у Neon</span>
              <h3 className="text-2xl font-black text-slate-900">{tenants.length} схем</h3>
            </div>
          </div>

          <div className="ako-card p-5 rounded-2xl flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Рівень ізоляції даних</span>
              <h3 className="text-2xl font-black text-slate-900">100% Zero-Leak</h3>
            </div>
          </div>
        </div>

        {/* Tenant Creation Form (Only for Admins) */}
        <div className="ako-card p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Створити нову корпоративну організацію
                </h2>
                <p className="text-xs text-slate-500">
                  Автоматично створює нову окрему схему PostgreSQL в Neon та запускає міграції
                </p>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
              1-Click Provisioning
            </span>
          </div>

          {provisionResult && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-center gap-3 ${
                provisionResult.success
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {provisionResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{provisionResult.message}</span>
            </div>
          )}

          <form onSubmit={handleProvisionTenant} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Назва компанії *
              </label>
              <input
                type="text"
                required
                placeholder="Наприклад: Monobank Corp"
                value={newTenantName}
                onChange={(e) => {
                  setNewTenantName(e.target.value);
                  if (!newSubdomain) {
                    setNewSubdomain(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "")
                        .slice(0, 20)
                    );
                  }
                }}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Сабдомен схеми (Neon schema) *
              </label>
              <input
                type="text"
                required
                placeholder="наприклад: monobank"
                value={newSubdomain}
                onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email першого HR-Адміна (опціонально)
              </label>
              <input
                type="email"
                placeholder="admin@monobank.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="sm:col-span-3 pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={provisioning || !newTenantName.trim() || !newSubdomain.trim()}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {provisioning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Розгортання схеми в Neon PostgreSQL...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Розгорнути схему компанії в Neon →
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Registered Companies Table */}
        <div className="ako-card p-6 sm:p-8 rounded-3xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Зареєстровані клієнти (Організації платформи)
              </h2>
              <p className="text-xs text-slate-500">
                Клікніть на будь-яку компанію, щоб увійти в її простір або переглянути HR-панель
              </p>
            </div>

            <button
              onClick={loadTenants}
              disabled={fetchingTenants}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5"
              title="Оновити список"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetchingTenants ? "animate-spin" : ""}`} />
              <span>Оновити</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <div
                key={t.subdomain}
                className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition bg-white space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      АКТИВНИЙ ТЕНАНТ
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      schema: <strong className="text-slate-700">"{t.subdomain}"</strong>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                  <p className="text-xs text-slate-500">
                    Ізольована схема бази даних у Neon PostgreSQL з власними користувачами, курсами та прогресом.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchToTenantAsAdmin(t.subdomain)}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Увійти в компанію як Admin</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      href={`/admin?tenant=${encodeURIComponent(t.subdomain)}`}
                      className="flex-1 py-1.5 text-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold transition"
                    >
                      HR Студія
                    </Link>
                    <Link
                      href={`/learn?tenant=${encodeURIComponent(t.subdomain)}`}
                      className="flex-1 py-1.5 text-center rounded-lg bg-slate-50 hover:bg-slate-100 text-indigo-600 font-semibold transition"
                    >
                      Навчання
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SpotifyShell>
  );
}

export default function SuperadminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-indigo-600 font-medium text-sm">
          Завантаження консолі суперадміністратора...
        </div>
      }
    >
      <SuperadminContent />
    </Suspense>
  );
}
