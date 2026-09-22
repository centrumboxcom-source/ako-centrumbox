"use client";

import React, { useState, useRef } from "react";
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
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface BlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  tenantSubdomain: string;
}

export function BlockEditor({ blocks, onChange, tenantSubdomain }: BlockEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetImageBlockId, setTargetImageBlockId] = useState<string | null>(null);

  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Add block helpers
  const addBlock = (type: BlockType, index?: number) => {
    let newBlock: ContentBlock;
    const id = generateId();

    switch (type) {
      case "heading":
        newBlock = { id, type: "heading", level: 2, text: "Новий заголовок" };
        break;
      case "text":
        newBlock = { id, type: "text", text: "Введіть текст уроку тут..." };
        break;
      case "video":
        newBlock = { id, type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "Відеоматеріал" };
        break;
      case "code":
        newBlock = {
          id,
          type: "code",
          language: "typescript",
          code: "// Приклад коду\nfunction greet(name: string): string {\n  return `Привіт, ${name}!`;\n}",
        };
        break;
      case "image":
        newBlock = {
          id,
          type: "image",
          url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&auto=format&fit=crop&q=80",
          caption: "Ілюстрація до уроку",
        };
        break;
      case "callout":
        newBlock = {
          id,
          type: "callout",
          variant: "info",
          text: "Важлива інформація для студентів.",
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

  // Upload file handler
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
        headers: {
          "x-tenant-override": tenantSubdomain,
        },
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
      setUploadError(err.message || "Помилка мережі при завантаженні");
    } finally {
      setUploadingBlockId(null);
      setTargetImageBlockId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for media upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Editor Toolbar & Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl backdrop-blur-md sticky top-20 z-10 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "edit"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Edit3 className="h-4 w-4" />
            Редактор блоків
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
              {blocks.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === "preview"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Eye className="h-4 w-4" />
            Попередній перегляд
          </button>
        </div>

        {activeTab === "edit" && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-medium text-slate-400 mr-1 hidden md:inline">
              Додати блок:
            </span>
            <button
              type="button"
              onClick={() => addBlock("heading")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати заголовок"
            >
              <Heading className="h-3.5 w-3.5 text-indigo-400" />
              <span>Заголовок</span>
            </button>
            <button
              type="button"
              onClick={() => addBlock("text")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати текст"
            >
              <Type className="h-3.5 w-3.5 text-emerald-400" />
              <span>Текст</span>
            </button>
            <button
              type="button"
              onClick={() => addBlock("video")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати відео"
            >
              <Video className="h-3.5 w-3.5 text-rose-400" />
              <span>Відео</span>
            </button>
            <button
              type="button"
              onClick={() => addBlock("code")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати блок коду"
            >
              <Code className="h-3.5 w-3.5 text-amber-400" />
              <span>Код</span>
            </button>
            <button
              type="button"
              onClick={() => addBlock("image")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати зображення"
            >
              <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
              <span>Зображення</span>
            </button>
            <button
              type="button"
              onClick={() => addBlock("callout")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/60 transition"
              title="Додати примітку"
            >
              <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
              <span>Примітка</span>
            </button>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/70 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Live Preview View */}
      {activeTab === "preview" ? (
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl">
          <div className="pb-4 mb-6 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Вигляд уроку для студента
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-800/60 text-indigo-300">
              Попередній перегляд
            </span>
          </div>
          <BlockRenderer blocks={blocks} />
        </div>
      ) : (
        /* Blocks List / Builder View */
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              <Sparkles className="h-12 w-12 text-indigo-400/60 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">
                Конструктор уроку порожній
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                Почніть створювати навчальний матеріал. Додайте заголовок, текст, відео або інтерактивний код за допомогою панелі вище.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => addBlock("heading")}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="h-4 w-4" /> Додати заголовок
                </button>
                <button
                  type="button"
                  onClick={() => addBlock("text")}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Додати текст
                </button>
              </div>
            </div>
          ) : (
            blocks.map((block, index) => (
              <div
                key={block.id}
                className="group relative rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition shadow-lg overflow-hidden"
              >
                {/* Block Header */}
                <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center h-5 w-5 rounded-md bg-slate-800 text-slate-400 font-mono text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1.5 font-medium text-slate-300">
                      {block.type === "heading" && <Heading className="h-3.5 w-3.5 text-indigo-400" />}
                      {block.type === "text" && <Type className="h-3.5 w-3.5 text-emerald-400" />}
                      {block.type === "video" && <Video className="h-3.5 w-3.5 text-rose-400" />}
                      {block.type === "code" && <Code className="h-3.5 w-3.5 text-amber-400" />}
                      {block.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />}
                      {block.type === "callout" && <MessageSquare className="h-3.5 w-3.5 text-purple-400" />}
                      <span className="capitalize">
                        {block.type === "heading" && "Заголовок"}
                        {block.type === "text" && "Текстовий блок"}
                        {block.type === "video" && "Відео"}
                        {block.type === "code" && "Блок коду"}
                        {block.type === "image" && "Зображення"}
                        {block.type === "callout" && "Примітка"}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Reorder, Duplicate, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveBlock(index, "up")}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition"
                      title="Перемістити вище"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(index, "down")}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition"
                      title="Перемістити нижче"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateBlock(block.id)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition ml-1"
                      title="Дублювати блок"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBlock(block.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                      title="Видалити блок"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Block Content Editor */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* HEADING BLOCK */}
                  {block.type === "heading" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Рівень:</label>
                        {[1, 2, 3].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => updateBlock(block.id, { level: lvl as 1 | 2 | 3 })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition ${
                              block.level === lvl
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-slate-800 text-slate-400 hover:text-white"
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
                        placeholder="Введіть текст заголовка..."
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-semibold"
                      />
                    </div>
                  )}

                  {/* TEXT BLOCK */}
                  {block.type === "text" && (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        placeholder="Текст лекції або пояснення (підтримує абзаци)..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm leading-relaxed resize-y"
                      />
                      <p className="text-[11px] text-slate-500">
                        Підказка: використовуйте перенесення рядків для створення читабельних абзаців.
                      </p>
                    </div>
                  )}

                  {/* VIDEO BLOCK */}
                  {block.type === "video" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Посилання на відео (YouTube, Vimeo або MP4 URL):
                        </label>
                        <input
                          type="url"
                          value={block.url}
                          onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Підпис до відео (опціонально):
                        </label>
                        <input
                          type="text"
                          value={block.caption || ""}
                          onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                          placeholder="Наприклад: Відео-демонстрація роботи алгоритму"
                          className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* CODE BLOCK */}
                  {block.type === "code" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400">Мова програмування:</label>
                          <select
                            value={block.language}
                            onChange={(e) => updateBlock(block.id, { language: e.target.value })}
                            className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                          >
                            <option value="typescript">TypeScript</option>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="sql">SQL (PostgreSQL)</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="json">JSON</option>
                            <option value="bash">Bash / Shell</option>
                          </select>
                        </div>
                      </div>
                      <textarea
                        rows={6}
                        value={block.code}
                        onChange={(e) => updateBlock(block.id, { code: e.target.value })}
                        placeholder="// Введіть код тут..."
                        className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500 leading-relaxed"
                      />
                    </div>
                  )}

                  {/* IMAGE BLOCK WITH CLOUD/TENANT UPLOAD */}
                  {block.type === "image" && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={block.url}
                          onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          placeholder="https://... або завантажте локальний файл"
                          className="flex-1 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                        <button
                          type="button"
                          disabled={uploadingBlockId === block.id}
                          onClick={() => triggerImageUpload(block.id)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0 shadow-md shadow-indigo-600/20"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingBlockId === block.id ? "Завантаження..." : "Завантажити файл"}
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={block.caption || ""}
                          onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                          placeholder="Підпис до зображення..."
                          className="w-full px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>

                      {block.url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-slate-800 bg-black/40 max-h-48 flex items-center justify-center">
                          <img
                            src={block.url}
                            alt={block.caption || "Попередній перегляд"}
                            className="max-h-48 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* CALLOUT BLOCK */}
                  {block.type === "callout" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Тип примітки:</label>
                        {(["info", "warning", "tip"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateBlock(block.id, { variant: v })}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                              block.variant === v
                                ? v === "info"
                                  ? "bg-indigo-600 text-white"
                                  : v === "warning"
                                  ? "bg-amber-600 text-white"
                                  : "bg-emerald-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {v === "info" && "Інформація"}
                            {v === "warning" && "Увага"}
                            {v === "tip" && "Порада"}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={3}
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                        placeholder="Текст примітки або підказки..."
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm resize-y"
                      />
                    </div>
                  )}
                </div>

                {/* Quick Add between blocks */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity py-1 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-center gap-2">
                  <span className="text-[10px] text-slate-500 font-medium">Вставити після:</span>
                  <button
                    type="button"
                    onClick={() => addBlock("text", index)}
                    className="text-[11px] text-slate-400 hover:text-indigo-300 transition"
                  >
                    + Текст
                  </button>
                  <span className="text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => addBlock("code", index)}
                    className="text-[11px] text-slate-400 hover:text-amber-300 transition"
                  >
                    + Код
                  </button>
                  <span className="text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => addBlock("image", index)}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 transition"
                  >
                    + Зображення
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
