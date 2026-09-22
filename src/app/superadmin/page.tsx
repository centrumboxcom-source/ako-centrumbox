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
  Copy,
  KeyRound,
  Check,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
  Save,
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
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    success: boolean;
    message: string;
    initialAdmin?: {
      email: string;
      password?: string;
      subdomain: string;
      role: string;
    } | null;
  } | null>(null);

  // Edit tenant modal state
  const [editingTenant, setEditingTenant] = useState<TenantInfo | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete tenant modal state
  const [deletingTenant, setDeletingTenant] = useState<TenantInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Action status message
  const [actionMessage, setActionMessage] = useState<{ success: boolean; message: string } | null>(null);

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
          adminPassword: newAdminPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setProvisionResult({
          success: true,
          message: `Організацію "${newTenantName}" успішно створено! Клієнтську схему "${newSubdomain.toLowerCase()}" розгорнуто в Neon PostgreSQL.`,
          initialAdmin: data.initialAdmin || null,
        });
        setNewTenantName("");
        setNewSubdomain("");
        setNewAdminEmail("");
        setNewAdminPassword("");
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

  // Handle Edit Tenant
  const handleOpenEdit = (t: TenantInfo) => {
    setEditingTenant(t);
    setEditName(t.name);
    setEditIsActive(t.isActive);
    setActionMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !editName.trim()) return;

    setSavingEdit(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/tenants/${editingTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (data.success && data.tenant) {
        setTenants((prev) =>
          prev.map((t) => (t.id === editingTenant.id ? { ...t, ...data.tenant } : t))
        );
        setActionMessage({
          success: true,
          message: `Дані організації "${editName}" успішно оновлено!`,
        });
        setEditingTenant(null);
      } else {
        setActionMessage({
          success: false,
          message: data.error || "Не вдалося оновити дані організації",
        });
      }
    } catch (err: any) {
      setActionMessage({
        success: false,
        message: err.message || "Помилка при збереженні",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Toggle Active/Suspended
  const handleToggleStatus = async (t: TenantInfo) => {
    const newStatus = !t.isActive;
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();
      if (data.success && data.tenant) {
        setTenants((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, isActive: newStatus } : item))
        );
        setActionMessage({
          success: true,
          message: `Статус організації "${t.name}" змінено на: ${newStatus ? "АКТИВНА" : "ПРИЗУПИНЕНА"}`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Tenant
  const handleConfirmDelete = async () => {
    if (!deletingTenant) return;

    setDeleting(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/tenants/${deletingTenant.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setTenants((prev) => prev.filter((t) => t.id !== deletingTenant.id));
        setActionMessage({
          success: true,
          message: `Організацію "${deletingTenant.name}" та її клієнтську схему "${deletingTenant.subdomain}" успішно видалено з Neon PostgreSQL.`,
        });
        setDeletingTenant(null);
      } else {
        setActionMessage({
          success: false,
          message: data.error || "Не вдалося видалити організацію",
        });
      }
    } catch (err: any) {
      setActionMessage({
        success: false,
        message: err.message || "Помилка при видаленні",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <SpotifyShell currentTenant="master">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-xs text-slate-500 font-medium">Перевірка прав доступу до системної консолі...</span>
        </div>
      </SpotifyShell>
    );
  }

  if (!currentUser) {
    return (
      <SpotifyShell currentTenant="master">
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
      <SpotifyShell currentTenant={currentUser?.tenantSubdomain || "master"}>
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
    <SpotifyShell currentTenant={currentUser?.tenantSubdomain || "master"}>
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
                <img src="/logo.png" alt="CENTRUM" className="h-4 w-4 object-cover rounded-md" />
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
            <div className="space-y-4">
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

              {/* Copyable Credentials Card for newly created HR Admin */}
              {provisionResult.initialAdmin && (
                <div className="p-5 rounded-2xl bg-indigo-50/80 border-2 border-indigo-200/90 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                          Реквізити доступу для нового HR-Адміністратора
                        </h4>
                        <p className="text-[11px] text-indigo-700">
                          Скопіюйте ці дані та передайте відповідальному співробітнику компанії:
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
                        const loginUrl = `${origin}/login?tenant=${provisionResult.initialAdmin?.subdomain}`;
                        const text = `Вітаємо у системі корпоративного навчання CENTRUMBOX AKO!\n\nОрганізація: ${provisionResult.initialAdmin?.subdomain}\nEmail для входу: ${provisionResult.initialAdmin?.email}\nПароль: ${provisionResult.initialAdmin?.password}\nПосилання для авторизації: ${loginUrl}\n\n(Після входу ви зможете керувати співробітниками, курсами та тестами в HR Студії)`;
                        navigator.clipboard.writeText(text);
                        setCopiedCredentials(true);
                        setTimeout(() => setCopiedCredentials(false), 3000);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                    >
                      {copiedCredentials ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Скопійовано! ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Скопіювати реквізити для відправки</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-white border border-indigo-100/90 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Email HR-а:</span>
                      <span className="font-mono text-xs font-bold text-slate-900 break-all select-all">
                        {provisionResult.initialAdmin.email}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-indigo-100/90 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Тимчасовий пароль:</span>
                      <span className="font-mono text-xs font-bold text-indigo-600 select-all">
                        {provisionResult.initialAdmin.password}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-indigo-100/90 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Посилання для входу:</span>
                      <span className="font-mono text-[11px] text-slate-600 truncate block select-all">
                        /login?tenant={provisionResult.initialAdmin.subdomain}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-indigo-100/50 text-[11px] text-indigo-900 leading-relaxed">
                    💡 <strong>Як співробітнику зайти:</strong> HR переходить на сторінку входу, вводить свій <strong>email</strong> та пароль <strong>{provisionResult.initialAdmin.password}</strong>. Платформа автоматично ідентифікує його компанію і надасть повний доступ до HR Студії & Конструктора курсів.
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleProvisionTenant} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
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
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
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
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Пароль HR-Адміна</span>
                <span className="text-[10px] text-slate-400 font-normal">дефолт: admin123</span>
              </label>
              <input
                type="text"
                placeholder="admin123"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                🔒 Для кожної компанії створюється окрема ізольована схема PostgreSQL в Neon.
              </span>
              <button
                type="submit"
                disabled={provisioning || !newTenantName.trim() || !newSubdomain.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
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

          {/* Action notification banner */}
          {actionMessage && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
                actionMessage.success
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {actionMessage.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span className="font-semibold">{actionMessage.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionMessage(null)}
                className="p-1 rounded-lg hover:bg-black/5 text-slate-500 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {tenants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenants.map((t) => (
                <div
                  key={t.subdomain}
                  className="p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition bg-white space-y-4 flex flex-col justify-between relative group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {t.isActive ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1.5 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          АКТИВНИЙ ТЕНАНТ
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase flex items-center gap-1.5 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          ⏸ ПРИЗУПИНЕНО
                        </span>
                      )}

                      {/* Action buttons: Edit & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Редагувати організацію"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTenant(t)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Видалити клієнта та схему з Neon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 truncate">{t.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                        schema: <strong className="text-indigo-600">"{t.subdomain}"</strong>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Ізольована схема бази даних у Neon PostgreSQL з власними користувачами, курсами та прогресом.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchToTenantAsAdmin(t.subdomain)}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20"
                    >
                      <span>Увійти в компанію як Admin</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <Link
                        href={`/admin?tenant=${encodeURIComponent(t.subdomain)}`}
                        className="flex-1 py-1.5 text-center rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition border border-slate-200/60"
                      >
                        HR Студія
                      </Link>
                      <Link
                        href={`/learn?tenant=${encodeURIComponent(t.subdomain)}`}
                        className="flex-1 py-1.5 text-center rounded-lg bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold transition border border-slate-200/60"
                      >
                        Навчання
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(t)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          t.isActive
                            ? "bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-700 border-slate-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                        }`}
                        title={t.isActive ? "Призупинити доступ компанії" : "Активувати доступ компанії"}
                      >
                        {t.isActive ? "⏸" : "▶"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Немає зареєстрованих організацій</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                База даних повністю чиста. Створіть вашу першу корпоративну організацію за допомогою форми вище.
              </p>
            </div>
          )}
        </div>

        {/* Edit Tenant Modal */}
        {editingTenant && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Редагування організації</h3>
                    <span className="text-[11px] text-slate-400 font-mono">schema: "{editingTenant.subdomain}"</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Назва компанії
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Схема PostgreSQL у Neon (незмінна)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingTenant.subdomain}
                    className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Статус активності</span>
                    <span className="text-[11px] text-slate-500 block">
                      {editIsActive ? "Користувачі компанії можуть входити" : "Доступ компанії призупинено"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(!editIsActive)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      editIsActive
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-slate-200 text-slate-700 border-slate-300"
                    }`}
                  >
                    {editIsActive ? "Активна ✓" : "Призупинена ⏸"}
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !editName.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingEdit ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Збереження...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Зберегти зміни</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingTenant && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-rose-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Видалити організацію?</h3>
                  <span className="text-xs text-slate-500">Компанія: <strong>{deletingTenant.name}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2 leading-relaxed">
                <p>
                  ⚠️ <strong>Увага! Це незворотна дія:</strong>
                </p>
                <p>
                  Клієнтська схема PostgreSQL <strong>"{deletingTenant.subdomain}"</strong> у хмарі Neon буде <strong>повністю видалена</strong> разом із:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                  <li>Всіма акаунтами співробітників та HR-адмінів</li>
                  <li>Корпоративними курсами та уроками</li>
                  <li>Статистикою, сертифікатами та балами прогресу</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingTenant(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Видалення з Neon DB...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Так, видалити клієнта та схему</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
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
