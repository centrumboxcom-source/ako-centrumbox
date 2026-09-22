"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, FileQuestion } from "lucide-react";
import { QuizBuilder, QuizDataInput } from "@/components/assessment/QuizBuilder";

export default function QuizBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = params?.id as string;
  const quizId = params?.quizId as string;
  const queryTenant = searchParams.get("tenant") || searchParams.get("__tenant") || "";

  const [tenantSubdomain, setTenantSubdomain] = useState(queryTenant);
  const [quizData, setQuizData] = useState<QuizDataInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve tenant and verify admin/instructor permissions
  useEffect(() => {
    async function checkAuthAndResolve() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (data.user.role !== "admin" && data.user.role !== "instructor") {
              router.push("/learn?error=insufficient_permissions");
              return;
            }
            if (!tenantSubdomain && data.user.tenantSubdomain) {
              setTenantSubdomain(data.user.tenantSubdomain);
            }
          } else {
            router.push("/login?error=unauthorized");
          }
        } else {
          router.push("/login?error=unauthorized");
        }
      } catch (e) {
        console.error("Помилка отримання сесії:", e);
      }
    }
    checkAuthAndResolve();
  }, [tenantSubdomain, router]);

  useEffect(() => {
    async function loadQuiz() {
      if (!quizId || !tenantSubdomain) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/quizzes/${quizId}?tenant=${encodeURIComponent(tenantSubdomain)}`,
          {
            headers: { "x-tenant-override": tenantSubdomain },
          }
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Не вдалося завантажити тест");
        }
        setQuizData(data.data);
      } catch (err: any) {
        setError(err.message || "Помилка завантаження даних");
      } finally {
        setLoading(false);
      }
    }

    if (tenantSubdomain && quizId) {
      loadQuiz();
    }
  }, [quizId, tenantSubdomain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Завантаження конструктора тесту...</p>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center">
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center gap-3 max-w-md">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error || "Тест не знайдено"}</span>
        </div>
        <Link
          href={`/admin/courses/${courseId}/builder?tenant=${tenantSubdomain}`}
          className="mt-4 text-indigo-400 hover:text-indigo-300 text-xs font-semibold"
        >
          ← Повернутися до конструктора курсу
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/courses/${courseId}/builder?tenant=${tenantSubdomain}`}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            До конструктора курсу
          </Link>

          <div className="h-5 w-[1px] bg-slate-800" />

          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-800/60 text-indigo-300 font-mono">
              {tenantSubdomain}
            </span>
            <span className="text-sm font-bold text-white truncate max-w-sm">
              {quizData.title}
            </span>
          </div>
        </div>
      </header>

      <main className="p-6 sm:p-8 flex-1 overflow-y-auto">
        <QuizBuilder
          initialData={quizData}
          tenantSubdomain={tenantSubdomain}
          onSaved={(updated) => setQuizData(updated)}
        />
      </main>
    </div>
  );
}
