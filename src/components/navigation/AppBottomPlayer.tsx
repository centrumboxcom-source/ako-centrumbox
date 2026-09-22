"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Play,
  CheckCircle2,
  Sparkles,
  Maximize2,
  X,
  Volume2,
  Layers,
  ChevronRight,
  RotateCcw,
  BookOpen,
} from "lucide-react";

interface AppBottomPlayerProps {
  currentTenant?: string;
}

export function AppBottomPlayer({ currentTenant: propTenant }: AppBottomPlayerProps) {
  const searchParams = useSearchParams();
  const activeTenant =
    propTenant ||
    searchParams.get("tenant") ||
    searchParams.get("__tenant") ||
    "acme";

  const [visible, setVisible] = useState(true);
  const [learningTrack, setLearningTrack] = useState<{
    courseTitle: string;
    activeLessonTitle: string;
    progressPercent: number;
    completedCount: number;
    totalCount: number;
    pointsReward: number;
    courseId?: string;
  } | null>(null);

  useEffect(() => {
    async function loadActiveTrack() {
      try {
        const res = await fetch(`/api/student/dashboard?tenant=${encodeURIComponent(activeTenant)}`, {
          headers: { "x-tenant-override": activeTenant },
        });
        const data = await res.json();
        if (res.ok && data.success && data.data?.courses?.length > 0) {
          const firstCourse = data.data.courses[0];
          setLearningTrack({
            courseTitle: firstCourse.title,
            activeLessonTitle: firstCourse.isCompleted
              ? "Усі модулі курсу успішно складено!"
              : "Модуль: Архітектура бази даних",
            progressPercent: firstCourse.progressPercent || 100,
            completedCount: firstCourse.completedLessons || 2,
            totalCount: firstCourse.totalLessons || 2,
            pointsReward: 10,
            courseId: firstCourse.id,
          });
        }
      } catch {
        // Fallback default
        setLearningTrack({
          courseTitle: "Основи веб-розробки та безпеки 2026",
          activeLessonTitle: "Модуль: Архітектура Multi-tenant",
          progressPercent: 100,
          completedCount: 2,
          totalCount: 2,
          pointsReward: 30,
        });
      }
    }

    loadActiveTrack();
  }, [activeTenant]);

  if (!visible || !learningTrack) return null;

  return (
    <div className="fixed bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-40 max-w-5xl mx-auto animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#0f1422]/95 border border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(30,215,96,0.15)] backdrop-blur-2xl flex items-center justify-between gap-4">
        {/* Left: Track / Module Thumbnail & Titles */}
        <div className="flex items-center gap-3.5 min-w-0 max-w-xs sm:max-w-sm">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-[#1ed760] via-indigo-600 to-purple-600 p-[2px] shrink-0 shadow-lg shadow-[#1ed760]/20">
            <div className="h-full w-full bg-[#0d121d] rounded-[14px] flex items-center justify-center text-white">
              <BookOpen className="h-5 w-5 text-[#1ed760]" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#1ed760]/20 text-[#1ed760] uppercase tracking-wider">
                Зараз у плеєрі
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                {learningTrack.completedCount}/{learningTrack.totalCount} модулів
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-black text-white truncate">
              {learningTrack.activeLessonTitle}
            </h4>
            <p className="text-[11px] text-slate-400 truncate">
              {learningTrack.courseTitle}
            </p>
          </div>
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="flex-1 max-w-md hidden md:flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <Link
              href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
              className="h-9 w-9 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 transition-all flex items-center justify-center text-black shadow-md shadow-[#1ed760]/30"
              title="Продовжити навчання"
            >
              <Play className="h-4 w-4 fill-black ml-0.5" />
            </Link>
          </div>

          <div className="w-full flex items-center gap-2.5 text-[11px] text-slate-400">
            <span className="font-mono text-xs text-white font-semibold">
              {learningTrack.progressPercent}%
            </span>
            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1ed760] to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${learningTrack.progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">100%</span>
          </div>
        </div>

        {/* Right: Quick Action & Dismiss */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-600/30 text-amber-300 text-xs font-mono font-bold">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>+{learningTrack.pointsReward} б.</span>
          </div>

          <Link
            href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>До курсу</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          <button
            onClick={() => setVisible(false)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Згорнути панель"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
