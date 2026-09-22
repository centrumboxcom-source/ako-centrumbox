"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  ContentBlock,
  BlockType,
  HeadingBlock,
  TextBlock,
  VideoBlock,
  CodeBlock,
  ImageBlock,
  CalloutBlock,
} from "@/db/schema/tenant";
import { BlockRenderer } from "./BlockRenderer";
import {
  Heading,
  Type,
  Video,
  Code,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Upload,
  Eye,
  Edit3,
  Columns,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Award,
  List,
  ListOrdered,
  Quote,
  Lightbulb,
  AlertTriangle,
  Info,
  PlayCircle,
  FileText,
} from "lucide-react";

interface ArticleLessonEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  tenantSubdomain: string;
  lessonTitle: string;
  onLessonTitleChange?: (title: string) => void;
  viewMode?: "writer" | "split" | "preview";
  onViewModeChange?: (mode: "writer" | "split" | "preview") => void;
}

export function ArticleLessonEditor({
  blocks,
  onChange,
  tenantSubdomain,
  lessonTitle,
  onLessonTitleChange,
  viewMode: controlledViewMode,
  onViewModeChange,
}: ArticleLessonEditorProps) {
  const [internalViewMode, setInternalViewMode] = useState<"writer" | "split" | "preview">("writer");
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetImageBlockId, setTargetImageBlockId] = useState<string | null>(null);

  const generateId = () => `b_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Calculate article reading stats
  const stats = useMemo(() => {
    let wordCount = lessonTitle.trim() ? lessonTitle.trim().split(/\s+/).length : 0;
    blocks.forEach((b) => {
      if (b.type === "heading" || b.type === "text" || b.type === "callout") {
        const text = (b as any).text || "";
        if (text.trim()) {
          wordCount += text.trim().split(/\s+/).length;
        }
      }
    });
    const readMinutes = Math.max(1, Math.ceil(wordCount / 160));
    return { wordCount, readMinutes };
  }, [blocks, lessonTitle]);

  // Block management
  const addBlock = (type: BlockType, index?: number) => {
    let newBlock: ContentBlock;
    const id = generateId();

    switch (type) {
      case "heading":
        newBlock = { id, type: "heading", level: 2, text: "Новий розділ статті" };
        break;
      case "text":
        newBlock = {
          id,
          type: "text",
          text: "Введіть зміст матеріалу... Ви можете писати звичайний текст, робити списки (починаючи з • або 1.), або цитати (починаючи з > ).",
        };
        break;
      case "video":
        newBlock = {
          id,
          type: "video",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          caption: "Відеоматеріал до уроку",
        };
        break;
      case "code":
        newBlock = {
          id,
          type: "code",
          language: "typescript",
          code: "// Приклад інтерактивного коду\nfunction calculateProgress(completed: number, total: number): number {\n  return Math.round((completed / total) * 100);\n}",
        };
        break;
      case "image":
        newBlock = {
          id,
          type: "image",
          url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80",
          caption: "Ілюстрація до навчальної статті",
        };
        break;
      case "callout":
        newBlock = {
          id,
          type: "callout",
          variant: "tip",
          text: "Порада від експерта: практичне застосування цієї навички допоможе швидше засвоїти тему!",
        };
        break;
      default:
        return;
    }

    const nextBlocks = [...blocks];
    if (typeof index === "number" && index >= 0 && index <= blocks.length) {
      nextBlocks.splice(index + 1, 0, newBlock);
    } else {
      nextBlocks.push(newBlock);
    }
    onChange(nextBlocks);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    const nextBlocks = blocks.map((b) => {
      if (b.id === id) {
        return { ...b, ...updates } as ContentBlock;
      }
      return b;
    });
    onChange(nextBlocks);
  };

  const deleteBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const duplicateBlock = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const target = blocks[index];
    const clone = { ...target, id: generateId() };
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, clone);
    onChange(nextBlocks);
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIndex, 0, moved);
    onChange(nextBlocks);
  };

  // Upload handler
  const triggerImageUpload = (blockId: string) => {
    setTargetImageBlockId(blockId);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetImageBlockId) return;

    setUploadingBlockId(targetImageBlockId);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/upload?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        method: "POST",
        headers: { "x-tenant-override": tenantSubdomain },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося завантажити файл");
      }

      updateBlock(targetImageBlockId, {
        url: data.url,
        caption: file.name,
      });
    } catch (err: any) {
      setUploadError(err.message || "Помилка завантаження файлу");
    } finally {
      setUploadingBlockId(null);
      setTargetImageBlockId(null);
    }
  };

  // Quick formatting helpers for text blocks
  const appendPrefixToTextBlock = (blockId: string, currentText: string, prefix: string) => {
    const lines = currentText.split("\n");
    const updated = lines.map((l) => (l.trim().startsWith(prefix) ? l : `${prefix}${l}`)).join("\n");
    updateBlock(blockId, { text: updated });
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Top Floating Control Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-4 z-20 backdrop-blur-md bg-white/95">
        {/* Left: View Mode Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode("writer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === "writer"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Редактор статті</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === "split"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Розділений екран (Split)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              viewMode === "preview"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Прев'ю студента</span>
          </button>
        </div>

        {/* Center: Article Reading Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            ~{stats.readMinutes} хв читання
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {stats.wordCount} слів
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-amber-600 font-semibold">
            <Award className="h-3.5 w-3.5 text-amber-500" />
            +10 балів
          </span>
        </div>

        {/* Right: Quick Block Inserters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => addBlock("heading")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Додати заголовок розділу"
          >
            <Heading className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Розділ</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock("text")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Додати текстовий абзац"
          >
            <Type className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Текст</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock("callout")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Додати примітку або практичну пораду"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Порада</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock("video")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Вставити відео з YouTube або Vimeo"
          >
            <Video className="h-3.5 w-3.5 text-rose-500" />
            <span className="hidden sm:inline">Відео</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock("image")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Додати зображення"
          >
            <ImageIcon className="h-3.5 w-3.5 text-cyan-600" />
            <span className="hidden sm:inline">Фото</span>
          </button>

          <button
            type="button"
            onClick={() => addBlock("code")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 text-xs font-semibold flex items-center gap-1 transition"
            title="Додати блок програмного коду"
          >
            <Code className="h-3.5 w-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Код</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      {viewMode === "preview" ? (
        /* Full Preview */
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-sm max-w-4xl mx-auto space-y-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                Попередній перегляд для студента
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {lessonTitle || "Назва уроку"}
              </h1>
            </div>
          </div>
          <BlockRenderer blocks={blocks} />
        </div>
      ) : (
        /* Writer or Split View */
        <div className={viewMode === "split" ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "max-w-4xl mx-auto"}>
          {/* Left Column: Article Writer Canvas */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            {/* Lesson Title Input */}
            <div className="space-y-1.5 pb-4 border-b border-slate-100">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Головний заголовок уроку
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => onLessonTitleChange && onLessonTitleChange(e.target.value)}
                placeholder="Введіть захопливу назву теми чи статті..."
                className="w-full text-xl sm:text-2xl font-black text-slate-900 border-0 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none py-1 bg-transparent placeholder-slate-300"
              />
            </div>

            {/* Blocks List */}
            {blocks.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 p-6 space-y-3">
                <Sparkles className="h-10 w-10 text-indigo-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Урок ще не містить контенту</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Натисніть кнопку нижче, щоб додати перший розділ, текстовий абзац, навчальне відео чи примітку.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => addBlock("text")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    + Почати писати текст
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("video")}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    + Додати відео
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    className="group relative rounded-2xl border border-slate-200/80 hover:border-indigo-300 bg-white hover:shadow-md transition p-4 sm:p-5 space-y-3"
                  >
                    {/* Block Toolbar Header */}
                    <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-xs capitalize">
                          {block.type === "heading" && <Heading className="h-3.5 w-3.5 text-indigo-600" />}
                          {block.type === "text" && <Type className="h-3.5 w-3.5 text-emerald-600" />}
                          {block.type === "callout" && <Lightbulb className="h-3.5 w-3.5 text-amber-500" />}
                          {block.type === "video" && <Video className="h-3.5 w-3.5 text-rose-500" />}
                          {block.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-cyan-600" />}
                          {block.type === "code" && <Code className="h-3.5 w-3.5 text-indigo-500" />}
                          {block.type === "heading" && `Підзаголовок (H${block.level})`}
                          {block.type === "text" && "Текстовий блок"}
                          {block.type === "callout" && "Примітка / Callout"}
                          {block.type === "video" && "Відеоматеріал"}
                          {block.type === "image" && "Ілюстрація"}
                          {block.type === "code" && "Блок коду"}
                        </span>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveBlock(index, "up")}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 transition"
                          title="Підняти вище"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === blocks.length - 1}
                          onClick={() => moveBlock(index, "down")}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 transition"
                          title="Опустити нижче"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateBlock(block.id)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition ml-0.5"
                          title="Дублювати блок"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBlock(block.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition ml-0.5"
                          title="Видалити цей блок"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Block Specific Form Fields */}

                    {/* 1. HEADING */}
                    {block.type === "heading" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 mr-1">Розмір:</span>
                          {[1, 2, 3].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => updateBlock(block.id, { level: lvl as 1 | 2 | 3 })}
                              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold transition ${
                                block.level === lvl
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              H{lvl}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={block.text}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          placeholder="Заголовок розділу..."
                          className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 font-bold ${
                            block.level === 1
                              ? "text-xl sm:text-2xl"
                              : block.level === 2
                              ? "text-lg sm:text-xl"
                              : "text-base"
                          }`}
                        />
                      </div>
                    )}

                    {/* 2. TEXT WITH QUICK FORMATTING */}
                    {block.type === "text" && (
                      <div className="space-y-2">
                        {/* Inline helpers */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-400 mr-1">Вставити:</span>
                          <button
                            type="button"
                            onClick={() => appendPrefixToTextBlock(block.id, block.text, "• ")}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                            title="Зробити рядки списком із маркерами"
                          >
                            <List className="h-3 w-3 text-indigo-500" />
                            Маркери
                          </button>
                          <button
                            type="button"
                            onClick={() => appendPrefixToTextBlock(block.id, block.text, "1. ")}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                            title="Зробити нумерованим списком"
                          >
                            <ListOrdered className="h-3 w-3 text-indigo-500" />
                            Нумерація
                          </button>
                          <button
                            type="button"
                            onClick={() => appendPrefixToTextBlock(block.id, block.text, "> ")}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                            title="Оформити цитатою"
                          >
                            <Quote className="h-3 w-3 text-indigo-500" />
                            Цитата
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          value={block.text}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          placeholder="Пишіть текст матеріалу, абзаци, думки та пояснення..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 text-sm leading-relaxed resize-y"
                        />
                      </div>
                    )}

                    {/* 3. CALLOUT / INTERACTIVE NOTE */}
                    {block.type === "callout" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 mr-1">Тип примітки:</span>
                          {[
                            { id: "tip", label: "💡 Порада від експерта", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                            { id: "warning", label: "⚠️ Важливо / Увага", cls: "bg-amber-50 text-amber-700 border-amber-200" },
                            { id: "info", label: "ℹ️ Корисне інфо", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                            { id: "task", label: "🎯 Практичне завдання", cls: "bg-purple-50 text-purple-700 border-purple-200" },
                          ].map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => updateBlock(block.id, { variant: v.id as any })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                                block.variant === v.id
                                  ? `${v.cls} shadow-sm ring-1 ring-offset-1 ring-indigo-400`
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={3}
                          value={block.text}
                          onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                          placeholder="Текст примітки або практичного завдання..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 text-xs sm:text-sm leading-relaxed resize-y"
                        />
                      </div>
                    )}

                    {/* 4. VIDEO */}
                    {block.type === "video" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Посилання на відео (YouTube, Vimeo, MP4):
                          </label>
                          <input
                            type="text"
                            value={block.url}
                            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Підпис до відео:
                          </label>
                          <input
                            type="text"
                            value={block.caption || ""}
                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                            placeholder="Наприклад: Відео-інструкція до розділу 1"
                            className="w-full px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* 5. IMAGE */}
                    {block.type === "image" && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={block.url}
                            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                            placeholder="URL зображення (https://...)"
                            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            disabled={uploadingBlockId === block.id}
                            onClick={() => triggerImageUpload(block.id)}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 shrink-0"
                          >
                            <Upload className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{uploadingBlockId === block.id ? "Завантаження..." : "Завантажити"}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={block.caption || ""}
                          onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                          placeholder="Підпис до ілюстрації..."
                          className="w-full px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}

                    {/* 6. CODE */}
                    {block.type === "code" && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold text-slate-400">Мова:</label>
                          <select
                            value={block.language || "typescript"}
                            onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                          >
                            <option value="typescript">TypeScript</option>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="sql">SQL / Postgres</option>
                            <option value="bash">Bash / Shell</option>
                            <option value="json">JSON</option>
                            <option value="html">HTML / CSS</option>
                          </select>
                        </div>

                        <textarea
                          rows={5}
                          value={block.code}
                          onChange={(e) => updateBlock(block.id, { code: e.target.value })}
                          placeholder="Введіть код тут..."
                          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs leading-relaxed focus:outline-none resize-y"
                        />
                      </div>
                    )}

                    {/* Quick Insert Between Blocks */}
                    <div className="pt-2 flex justify-center opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => addBlock("text", index)}
                        className="px-3 py-1 rounded-full bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white text-[11px] font-bold border border-indigo-200 transition shadow-sm flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Вставити блок нижче
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Live Student Preview in Split Mode */}
          {viewMode === "split" && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 sticky top-24 max-h-[85vh] overflow-y-auto">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  Живий вигляд для студента (Live)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Синхронізовано
                </span>
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 pb-3 border-b border-slate-100">
                  {lessonTitle || "Назва уроку"}
                </h1>
              </div>

              <BlockRenderer blocks={blocks} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
