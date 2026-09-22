"use client";

import React, { useState } from "react";
import { Lesson } from "@/db/schema/tenant";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  BookOpen,
  FileText,
  Save,
  Check,
  AlertCircle,
  Clock,
} from "lucide-react";

interface LessonReorderListProps {
  courseId: string;
  lessons: Lesson[];
  activeLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onLessonsChange: (lessons: Lesson[]) => void;
  tenantSubdomain: string;
}

export function LessonReorderList({
  courseId,
  lessons,
  activeLessonId,
  onSelectLesson,
  onLessonsChange,
  tenantSubdomain,
}: LessonReorderListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderSavedSuccess, setOrderSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Move a lesson up or down in the local list and automatically sync with backend
  const moveLesson = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const reordered = [...lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update order numbers locally
    const updated = reordered.map((l, idx) => ({ ...l, order: idx + 1 }));
    onLessonsChange(updated);

    // Save order to API
    await saveReorderedLessons(updated);
  };

  const saveReorderedLessons = async (orderedList: Lesson[]) => {
    setIsSavingOrder(true);
    setErrorMessage(null);
    setOrderSavedSuccess(false);

    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/reorder?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            orderedLessonIds: orderedList.map((l) => l.id),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося зберегти порядок уроків");
      }

      setOrderSavedSuccess(true);
      setTimeout(() => setOrderSavedSuccess(false), 2500);
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка оновлення порядку");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setErrorMessage(null);
    try {
      const defaultBlocks = [
        {
          id: `b_${Date.now()}_1`,
          type: "heading",
          level: 1,
          text: newTitle.trim(),
        },
        {
          id: `b_${Date.now()}_2`,
          type: "text",
          text: "Введіть матеріал уроку тут...",
        },
      ];

      const res = await fetch(
        `/api/courses/${courseId}/lessons?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-override": tenantSubdomain,
          },
          body: JSON.stringify({
            title: newTitle.trim(),
            content: defaultBlocks,
            order: lessons.length + 1,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося створити урок");
      }

      const created = data.data as Lesson;
      const updated = [...lessons, created];
      onLessonsChange(updated);
      onSelectLesson(created.id);
      setNewTitle("");
      setIsCreating(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка створення уроку");
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!confirm(`Ви дійсно бажаєте видалити урок "${title}"?`)) return;

    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}?tenant=${encodeURIComponent(tenantSubdomain)}`,
        {
          method: "DELETE",
          headers: {
            "x-tenant-override": tenantSubdomain,
          },
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося видалити урок");
      }

      const remaining = lessons.filter((l) => l.id !== lessonId);
      onLessonsChange(remaining);
      if (activeLessonId === lessonId) {
        onSelectLesson(remaining[0]?.id || "");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Помилка видалення");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            Програма курсу ({lessons.length})
          </h2>
          <p className="text-xs text-slate-500">Сортування та перемикання уроків</p>
        </div>

        {orderSavedSuccess && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
            <Check className="h-3 w-3" /> Збережено
          </span>
        )}
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lesson List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {lessons.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
            У курсі ще немає уроків.
            <br />
            Натисніть кнопку нижче, щоб додати перший урок.
          </div>
        ) : (
          lessons.map((lesson, index) => {
            const isActive = activeLessonId === lesson.id;
            return (
              <div
                key={lesson.id}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/10"
                    : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
                }`}
                onClick={() => onSelectLesson(lesson.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`flex items-center justify-center h-6 w-6 rounded-lg text-xs font-mono font-bold shrink-0 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                      }`}
                    >
                      {lesson.title}
                    </p>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <FileText className="h-2.5 w-2.5" />
                      Позиція #{lesson.order || index + 1}
                    </span>
                  </div>
                </div>

                {/* Reorder Buttons & Actions */}
                <div
                  className="flex items-center gap-1 ml-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    disabled={index === 0 || isSavingOrder}
                    onClick={() => moveLesson(index, "up")}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition"
                    title="Підняти вище"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === lessons.length - 1 || isSavingOrder}
                    onClick={() => moveLesson(index, "down")}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 transition"
                    title="Опустити нижче"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition ml-0.5"
                    title="Видалити урок"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Lesson Form or Trigger */}
      <div className="pt-2 border-t border-slate-800">
        {isCreating ? (
          <form onSubmit={handleCreateLesson} className="space-y-2">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Назва нового уроку..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-indigo-500 text-white placeholder-slate-600 text-xs focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
              >
                Створити
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTitle("");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Скасувати
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-900/40 hover:bg-indigo-950/20 text-indigo-300 hover:text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm"
          >
            <Plus className="h-4 w-4 text-indigo-400" />
            Додати новий урок
          </button>
        )}
      </div>
    </div>
  );
}
