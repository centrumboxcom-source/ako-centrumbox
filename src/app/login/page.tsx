"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Lock,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Layers,
  Sparkles,
  UserCheck,
  Box,
  Server,
} from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const initialSubdomain = searchParams.get("tenant") || searchParams.get("subdomain") || searchParams.get("__tenant") || "";
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available tenants for dev selection
  const [tenants, setTenants] = useState<{ id: string; name: string; subdomain: string }[]>([]);

  useEffect(() => {
    fetch("/api/tenants/public")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.tenants.length > 0) {
          setTenants(data.tenants);
          if (!subdomain) {
            setSubdomain(data.tenants[0].subdomain);
          }
        }
      })
      .catch((err) => console.error(err));
  }, [subdomain]);

  const errorParam = searchParams.get("error");
  const userTenant = searchParams.get("userTenant");
  const targetTenant = searchParams.get("targetTenant");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetSub = (subdomain || searchParams.get("tenant") || searchParams.get("subdomain") || tenants[0]?.subdomain || "acme").trim().toLowerCase();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-override": targetSub,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          subdomain: targetSub,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Redirect based on role
        if (data.user.role === "admin") {
          router.push(`/admin?tenant=${encodeURIComponent(targetSub)}`);
        } else {
          router.push(`/learn?tenant=${encodeURIComponent(targetSub)}`);
        }
      } else {
        setError(data.error || "Не вдалося виконати вхід");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Мережева помилка");
    } finally {
      setLoading(false);
    }
  };

  // Demo 1-Click Fast Login
  const handleQuickDemoLogin = (demoRole: "admin" | "student") => {
    const activeSub = (subdomain || searchParams.get("tenant") || searchParams.get("subdomain") || tenants[0]?.subdomain || "acme").trim().toLowerCase();
    setSubdomain(activeSub);
    const demoEmail = demoRole === "admin" ? `admin@${activeSub}.com` : `employee@${activeSub}.com`;
    setEmail(demoEmail);
    setPassword(demoRole === "admin" ? "admin123" : "password123");
  };

  return (
    <div className="w-full max-w-md p-8 rounded-3xl relative shadow-xl bg-white border border-slate-200">
      <div className="text-center mb-6">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-600/20 text-white">
          <Box className="h-6 w-6" />
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            CENTRUM<span className="text-indigo-600">BOX</span>
          </h1>
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest">
            AKO
          </span>
        </div>
        <p className="text-xs text-slate-500">Вхід до корпоративної платформи навчання</p>
      </div>

      {/* Cross-tenant forbidden warning alert */}
      {errorParam === "cross_tenant_forbidden" && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold text-rose-900 mb-1">
              Блокування міжклієнтського доступу!
            </strong>
            <span>
              Ви маєте сесію компанії <strong className="font-mono text-slate-900">"{userTenant}"</strong>, але намагалися
              перейти до простору <strong className="font-mono text-slate-900">"{targetTenant}"</strong>.
            </span>
          </div>
        </div>
      )}

      {errorParam === "insufficient_permissions" && (
        <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>У вас недостатньо прав (потрібна роль Admin / HR для доступу до /admin).</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Company Subdomain Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
            Компанія (Сабдомен простору)
          </label>
          <div className="flex">
            <select
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono outline-none focus:border-indigo-600"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.subdomain} className="bg-white text-slate-900">
                  {t.name} ({t.subdomain})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-indigo-600" />
            Робочий Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@acme.com"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-indigo-600" />
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          {loading ? "Перевірка доступу до схеми..." : "Увійти до системи"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Quick 1-Click Demo Logins */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
          Швидкий тестовий вхід (Демо 1-Click):
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemoLogin("admin")}
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left text-xs transition flex flex-col"
          >
            <span className="text-slate-900 font-bold flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Роль: Admin
            </span>
            <span className="text-[10px] text-slate-500">admin123 (/admin)</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemoLogin("student")}
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 text-left text-xs transition flex flex-col"
          >
            <span className="text-slate-900 font-bold flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Роль: Студент
            </span>
            <span className="text-[10px] text-slate-500">password123 (/learn)</span>
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-indigo-600 hover:underline font-semibold">
          ← На головну сторінку CENTRUMBOX AKO
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <Suspense fallback={<div className="text-white text-sm">Завантаження форми входу...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
