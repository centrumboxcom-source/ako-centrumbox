"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface InviteData {
  email: string | null;
  role: "student" | "instructor" | "admin";
  expiresAt: string;
  maxUses: number;
  usesCount: number;
  tenantSubdomain: string;
  tenantName: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = (params?.token as string) || "";

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch and validate invite token on load
  useEffect(() => {
    if (!token) return;

    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.valid) {
          setInviteData(data.data);
          if (data.data.email) {
            setEmail(data.data.email);
          }
        } else {
          setErrorReason(data.reason || "invalid");
          setErrorMessage(data.error || "Недійсне або прострочене посилання-запрошення.");
        }
      })
      .catch((err) => {
        setErrorMessage("Помилка зв'язку з сервером під час перевірки посилання.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Будь ласка, вкажіть ваше ім'я та прізвище.");
      return;
    }

    const targetEmail = inviteData?.email || email;
    if (!targetEmail.trim()) {
      setFormError("Вкажіть адресу корпоративної електронної пошти.");
      return;
    }

    if (password.length < 6) {
      setFormError("Пароль повинен містити щонайменше 6 символів.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Введені паролі не збігаються.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: targetEmail.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося завершити реєстрацію");
      }

      setSuccessMessage(data.message || "Реєстрація успішна! Входимо до системи...");

      // Short delay then redirect
      setTimeout(() => {
        router.push(data.redirect || `/learn?tenant=${inviteData?.tenantSubdomain || ""}`);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || "Помилка при реєстрації");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
          <p className="text-sm font-medium">Перевірка запрошення...</p>
        </div>
      </div>
    );
  }

  // Error state: Token expired / revoked / exhausted / invalid
  if (errorMessage || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Запрошення недоступне</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {errorMessage || "Термін дії цього посилання вичерпано або його вже було використано."}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2 text-left">
            <p className="flex items-center gap-2 text-slate-300 font-medium">
              <Clock className="h-4 w-4 text-amber-400" />
              Термін дії посилань:
            </p>
            <p>
              Задля безпеки всі посилання дійсні 24–48 годин. Зверніться до вашого HR або адміністратора компанії для отримання нового інвайту.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              Перейти до сторінки входу →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleNames: Record<string, string> = {
    student: "Студент / Працівник",
    instructor: "Викладач / Інструктор",
    admin: "Адміністратор / HR",
  };

  const formattedExpiry = new Date(inviteData.expiresAt).toLocaleString("uk-UA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3 pb-4 border-b border-slate-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Building2 className="h-3.5 w-3.5" />
            Компанія: {inviteData.tenantName} ({inviteData.tenantSubdomain})
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Запрошення до команди <Sparkles className="h-5 w-5 text-indigo-400" />
          </h1>

          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Створіть свій особистий кабінет для доступу до корпоративних навчальних курсів, тестів та системи винагород.
          </p>
        </div>

        {/* Info badges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block text-[11px]">Призначена роль:</span>
            <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              {roleNames[inviteData.role] || inviteData.role}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block text-[11px]">Дійсне до:</span>
            <span className="text-amber-300 font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              {formattedExpiry}
            </span>
          </div>
        </div>

        {/* Messages */}
        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ваше повне ім'я (ПІБ) *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                placeholder="Оксана Василенко"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <User className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Корпоративний Email *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                disabled={!!inviteData.email}
                placeholder="vasylenko@company.com"
                value={inviteData.email || email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition ${
                  inviteData.email
                    ? "bg-slate-950/50 border-slate-800/80 text-slate-300 cursor-not-allowed"
                    : "bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                }`}
              />
              <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
              {inviteData.email && (
                <span title="Email закріплено за цим інвайтом" className="absolute right-3.5 top-3 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )}
            </div>
            {inviteData.email && (
              <p className="text-[11px] text-slate-500 mt-1">
                Адресу зафіксовано адміністратором компанії для цього посилання.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Придумайте пароль * (мін. 6 символів)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
              <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Підтвердіть пароль *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
              <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Створення акаунта та авторизація...
              </>
            ) : (
              <>
                Зареєструватися та розпочати навчання <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500">
          Вже маєте акаунт у цій компанії?{" "}
          <Link
            href={`/login?subdomain=${inviteData.tenantSubdomain}`}
            className="text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Увійти
          </Link>
        </div>
      </div>
    </div>
  );
}
