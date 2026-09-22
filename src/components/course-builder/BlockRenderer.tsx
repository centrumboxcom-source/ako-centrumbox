"use client";

import React, { useState } from "react";
import { ContentBlock } from "@/db/schema/tenant";
import {
  Code,
  Copy,
  Check,
  Info,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  PlayCircle,
} from "lucide-react";

interface BlockRendererProps {
  blocks: ContentBlock[];
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Convert youtube / vimeo to embed URL if needed
  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  if (!blocks || blocks.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 italic border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
        Контент цього уроку ще не заповнено.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h1 key={block.id} className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight pt-2">
                  {block.text}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={block.id} className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight pt-2 border-b border-slate-200 pb-2">
                  {block.text}
                </h2>
              );
            }
            return (
              <h3 key={block.id} className="text-lg font-semibold text-indigo-700 pt-1">
                {block.text}
              </h3>
            );
          }

          case "text": {
            return (
              <div key={block.id} className="text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line">
                {block.text}
              </div>
            );
          }

          case "code": {
            const isCopied = copiedId === block.id;
            return (
              <div key={block.id} className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md">
                <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Code className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-mono font-medium text-slate-300 uppercase">{block.language || "code"}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(block.id, block.code)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                    title="Скопіювати код"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[11px] text-emerald-400 font-semibold">Скопійовано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-semibold">Копіювати</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs sm:text-sm font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          }

          case "video": {
            const embed = getEmbedUrl(block.url);
            const isEmbed = embed.includes("youtube.com/embed") || embed.includes("player.vimeo.com");

            return (
              <div key={block.id} className="space-y-2">
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video relative shadow-lg">
                  {isEmbed ? (
                    <iframe
                      src={embed}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Відео уроку"
                    />
                  ) : (
                    <video src={block.url} controls className="w-full h-full object-contain" />
                  )}
                </div>
                {block.caption && (
                  <p className="text-xs text-slate-500 text-center italic">{block.caption}</p>
                )}
              </div>
            );
          }

          case "image": {
            return (
              <div key={block.id} className="space-y-2 my-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                  <img
                    src={block.url}
                    alt={block.caption || "Зображення уроку"}
                    className="w-full max-h-[500px] object-contain rounded-2xl mx-auto"
                  />
                </div>
                {block.caption && (
                  <p className="text-xs text-slate-500 text-center italic">{block.caption}</p>
                )}
              </div>
            );
          }

          case "callout": {
            const variantConfig = {
              info: {
                icon: Info,
                border: "border-indigo-200 bg-indigo-50/90 text-indigo-950",
                iconColor: "text-indigo-600",
                title: "Інформація",
              },
              warning: {
                icon: AlertTriangle,
                border: "border-amber-200 bg-amber-50/90 text-amber-950",
                iconColor: "text-amber-600",
                title: "Зверніть увагу",
              },
              tip: {
                icon: Lightbulb,
                border: "border-emerald-200 bg-emerald-50/90 text-emerald-950",
                iconColor: "text-emerald-600",
                title: "Порада",
              },
            }[block.variant || "info"];

            const IconComponent = variantConfig.icon;

            return (
              <div key={block.id} className={`p-4 rounded-2xl border ${variantConfig.border} flex items-start gap-3.5 my-3 shadow-sm`}>
                <IconComponent className={`h-5 w-5 ${variantConfig.iconColor} shrink-0 mt-0.5`} />
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  <strong className="block font-bold mb-1">{variantConfig.title}:</strong>
                  {block.text}
                </div>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
