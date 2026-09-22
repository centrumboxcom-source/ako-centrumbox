"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Box,
  RefreshCw,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorParam = searchParams.get("error");
  const userTenant = searchParams.get("userTenant");
  const targetTenant = searchParams.get("targetTenant");
  const fromParam = searchParams.get("from");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (data.success && data.redirectTo) {
        // Full page redirect to the matched workspace
        window.location.href = fromParam && fromParam !== "/login" ? fromParam : data.redirectTo;
      } else {
        setError(data.error || "Невірний email або пароль.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка підключення до сервера.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl relative shadow-2xl bg-white border border-slate-200/90">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg shadow-slate-200 border border-slate-200/90 flex items-center justify-center bg-slate-900">
          <img
            src="/logo.png"
            alt="CENTRUMBOX"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            CENTRUM<span className="text-indigo-600">BOX</span>
          </h1>
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest">
            AKO
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">Вхід до корпоративної платформи навчання</p>
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
          <span>У вас недостатньо прав (потрібна роль Admin для перегляду панелі).</span>
        </div>
      )}

      {errorParam === "session_expired" && (
        <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Ваша сесія завершилася. Будь ласка, увійдіть знову.</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="name@company.com"
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
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
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-600 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 mt-2"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Авторизація в просторі...</span>
            </>
          ) : (
            <>
              <span>Увійти до системи</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-4 border-t border-slate-100 text-center">
        <p className="text-[11px] text-slate-400">
          CENTRUMBOX AKO Multi-Tenant Corporate LMS • Вхід за єдиним корпоративним акаунтом
        </p>
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
