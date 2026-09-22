"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Users,
  Upload,
  Copy,
  Check,
  Plus,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Download,
  KeyRound,
  FileText,
} from "lucide-react";
import { Invite } from "@/db/schema/master";

interface InviteManagerProps {
  tenantSubdomain: string;
}

interface TenantEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  createdAt: string;
}

interface ParsedCsvEmployee {
  name: string;
  email: string;
  role: "student" | "instructor" | "admin";
  isValid: boolean;
  error?: string;
}

interface BulkResultItem {
  name: string;
  email: string;
  role: string;
  token?: string;
  inviteUrl?: string;
  password?: string;
  success?: boolean;
}

export default function InviteManager({ tenantSubdomain }: InviteManagerProps) {
  const [activeTab, setActiveTab] = useState<"generator" | "csv" | "invites" | "employees">("generator");

  // Single / Team invite state
  const [inviteType, setInviteType] = useState<"targeted" | "team">("targeted");
  const [targetEmail, setTargetEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"student" | "instructor" | "admin">("student");
  const [expiresInHours, setExpiresInHours] = useState<number>(48);
  const [maxUses, setMaxUses] = useState<number>(50);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Invites list state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // Employees list state
  const [employees, setEmployees] = useState<TenantEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // CSV Import state
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCsvEmployee[]>([]);
  const [csvImportMode, setCsvImportMode] = useState<"links" | "direct">("links");
  const [importing, setImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResultItem[] | null>(null);
  const [bulkSummaryMessage, setBulkSummaryMessage] = useState<string | null>(null);

  // Load invites
  const loadInvites = useCallback(async () => {
    if (!tenantSubdomain) return;
    setInvitesLoading(true);
    try {
      const res = await fetch(`/api/admin/invites?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        headers: { "x-tenant-override": tenantSubdomain },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInvites(data.data || []);
      }
    } catch (err) {
      console.error("Помилка завантаження інвайтів:", err);
    } finally {
      setInvitesLoading(false);
    }
  }, [tenantSubdomain]);

  // Load employees
  const loadEmployees = useCallback(async () => {
    if (!tenantSubdomain) return;
    setEmpLoading(true);
    try {
      const res = await fetch(`/api/admin/users?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        headers: { "x-tenant-override": tenantSubdomain },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error("Помилка завантаження співробітників:", err);
    } finally {
      setEmpLoading(false);
    }
  }, [tenantSubdomain]);

  useEffect(() => {
    if (tenantSubdomain) {
      loadInvites();
      loadEmployees();
    }
  }, [tenantSubdomain, loadInvites, loadEmployees]);

  // Generate invite handler
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenError(null);
    setGeneratedLink(null);

    try {
      const res = await fetch(`/api/admin/invites?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-override": tenantSubdomain,
        },
        body: JSON.stringify({
          email: inviteType === "targeted" ? targetEmail.trim() : null,
          role: inviteRole,
          expiresInHours: Number(expiresInHours),
          maxUses: inviteType === "targeted" ? 1 : Number(maxUses),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося згенерувати посилання");
      }

      setGeneratedLink(data.data.inviteUrl);
      loadInvites();
      if (inviteType === "targeted") {
        setTargetEmail("");
      }
    } catch (err: any) {
      setGenError(err.message || "Помилка сервера");
    } finally {
      setGenerating(false);
    }
  };

  // Revoke invite handler
  const handleRevokeInvite = async (id: string) => {
    if (!confirm("Ви дійсно бажаєте відкликати це посилання? Після цього реєстрація за ним стане неможливою.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/invites/${id}?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        method: "DELETE",
        headers: { "x-tenant-override": tenantSubdomain },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loadInvites();
      } else {
        alert(data.error || "Не вдалося відкликати інвайт");
      }
    } catch (err) {
      console.error("Помилка відкликання:", err);
    }
  };

  // Copy helper
  const copyToClipboard = async (text: string, isMain = false, inviteId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isMain) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
      if (inviteId) {
        setCopiedInviteId(inviteId);
        setTimeout(() => setCopiedInviteId(null), 2000);
      }
    } catch {
      alert("Скопійовано: " + text);
    }
  };

  // Parse CSV text
  const parseCsvContent = (content: string) => {
    setCsvText(content);
    setBulkResults(null);
    setBulkSummaryMessage(null);

    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    const rows: ParsedCsvEmployee[] = [];
    const isFirstRowHeader =
      lines[0].toLowerCase().includes("email") ||
      lines[0].toLowerCase().includes("пошта") ||
      lines[0].toLowerCase().includes("ім'я") ||
      lines[0].toLowerCase().includes("піб") ||
      lines[0].toLowerCase().includes("name");

    const startIndex = isFirstRowHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Split by comma or semicolon
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length < 2) continue;

      let name = parts[0] || "";
      let email = parts[1] || "";
      let roleRaw = parts[2]?.toLowerCase() || "student";

      // If parts[0] has an @ and parts[1] doesn't, swap them
      if (parts[0].includes("@") && !parts[1].includes("@")) {
        email = parts[0];
        name = parts[1];
      }

      let role: "student" | "instructor" | "admin" = "student";
      if (roleRaw.includes("admin") || roleRaw.includes("адмін") || roleRaw.includes("hr")) {
        role = "admin";
      } else if (roleRaw.includes("instruct") || roleRaw.includes("викладач") || roleRaw.includes("тренер")) {
        role = "instructor";
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = Boolean(name.length >= 2 && emailRegex.test(email));

      rows.push({
        name,
        email,
        role,
        isValid,
        error: !isValid
          ? name.length < 2
            ? "Закоротке ім'я"
            : "Некоректний email"
          : undefined,
      });
    }

    setParsedRows(rows);
  };

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCsvContent(text);
    };
    reader.readAsText(file);
  };

  // Download template
  const handleDownloadSampleCsv = () => {
    const csvContent =
      "ПІБ,Email,Роль\n" +
      "Олена Ковальчук,olena.kovalchuk@company.ua,student\n" +
      "Тарас Мельник,taras.melnyk@company.ua,student\n" +
      "Ірина Бойко,iryna.boyko@company.ua,instructor\n" +
      "Василь Грищенко,vasyl.hryshchenko@company.ua,admin\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `зразок_імпорту_${tenantSubdomain}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Run bulk import
  const handleRunBulkImport = async () => {
    const validItems = parsedRows.filter((r) => r.isValid);
    if (validItems.length === 0) {
      alert("Не знайдено жодного валідного запису для імпорту.");
      return;
    }

    setImporting(true);
    setBulkResults(null);
    setBulkSummaryMessage(null);

    try {
      const res = await fetch(`/api/admin/invites/bulk?tenant=${encodeURIComponent(tenantSubdomain)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-override": tenantSubdomain,
        },
        body: JSON.stringify({
          items: validItems.map((v) => ({
            name: v.name,
            email: v.email,
            role: v.role,
          })),
          mode: csvImportMode,
          expiresInHours: 48,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не вдалося виконати імпорт");
      }

      setBulkResults(data.data);
      setBulkSummaryMessage(data.message);
      loadInvites();
      loadEmployees();
    } catch (err: any) {
      alert("Помилка імпорту: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Export results to CSV
  const handleExportResultsCsv = () => {
    if (!bulkResults) return;

    let csvContent = "";
    if (csvImportMode === "links") {
      csvContent = "ПІБ,Email,Роль,Посилання для реєстрації (діє 48 годин)\n";
      bulkResults.forEach((r) => {
        csvContent += `"${r.name}","${r.email}","${r.role}","${r.inviteUrl || ""}"\n`;
      });
    } else {
      csvContent = "ПІБ,Email,Роль,Тимчасовий пароль,Статус\n";
      bulkResults.forEach((r) => {
        csvContent += `"${r.name}","${r.email}","${r.role}","${r.password || ""}","${r.success ? "Створено" : "Помилка"}"\n`;
      });
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `результати_onboarding_${tenantSubdomain}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <button
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "generator"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Link2 className="h-4 w-4" />
          Генератор посилань
        </button>

        <button
          onClick={() => setActiveTab("csv")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "csv"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Масовий Onboarding (CSV)
        </button>

        <button
          onClick={() => setActiveTab("invites")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "invites"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Clock className="h-4 w-4" />
          Активні інвайти ({invites.length})
        </button>

        <button
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === "employees"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Users className="h-4 w-4" />
          Співробітники компанії ({employees.length})
        </button>
      </div>

      {/* TAB 1: INVITE GENERATOR */}
      {activeTab === "generator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-indigo-400" />
                Створення посилання-запрошення
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Згенеруйте унікальне посилання з токеном, яке дозволить співробітнику самостійно зареєструватися.
              </p>
            </div>

            <form onSubmit={handleGenerateInvite} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setInviteType("targeted")}
                  className={`py-2 px-3 rounded-lg font-medium transition ${
                    inviteType === "targeted"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Індивідуальне (для Email)
                </button>
                <button
                  type="button"
                  onClick={() => setInviteType("team")}
                  className={`py-2 px-3 rounded-lg font-medium transition ${
                    inviteType === "team"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Командне (Team Link)
                </button>
              </div>

              {inviteType === "targeted" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Корпоративний Email співробітника *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ivan.shevchenko@company.ua"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Одноразове посилання, закріплене за цією конкретною адресою.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Максимальна кількість реєстрацій за цим посиланням
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Дозволяє зареєструватися команді до {maxUses} працівників за одним посиланням (наприклад, у Slack-чаті).
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Термін придатності
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={24}>24 години (1 доба)</option>
                    <option value={48}>48 годин (2 доби - рекомендовано)</option>
                    <option value={72}>72 години (3 доби)</option>
                    <option value={168}>7 днів (1 тиждень)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Призначена роль
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="student">Студент / Працівник</option>
                    <option value="instructor">Інструктор</option>
                    <option value="admin">Адміністратор / HR</option>
                  </select>
                </div>
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={generating}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-indigo-600/25"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Генерація токена...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Згенерувати invite-посилання
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result preview column */}
          <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Готове посилання для запрошення
              </h3>

              {generatedLink ? (
                <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-3">
                  <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Посилання успішно створено та готове до надсилання!
                  </span>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-200 font-mono select-all focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedLink, true)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition ${
                        copiedLink
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Скопійовано!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Копіювати
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Надішліть це посилання співробітнику в Slack, Teams або на пошту. Під час переходу він введе ім'я та пароль і автоматично буде доданий до вашого навчального простору.
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-2">
                  <Link2 className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Заповніть форму ліворуч і натисніть «Згенерувати», щоб отримати готове безпечне посилання.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
              <span className="text-slate-300 font-semibold block">Як це працює:</span>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>Токен формується за допомогою 256-бітної криптографічної випадковості.</li>
                <li>Автоматично деактивується через вказаний термін (24–48 годин).</li>
                <li>Працівник реєструється безпосередньо в базу даних вашої компанії (PostgreSQL schema).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CSV BULK IMPORT */}
      {activeTab === "csv" && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                Масовий Onboarding через CSV (для 100+ працівників)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Завантажте файл таблиці або вставте список співробітників для пакетної реєстрації або генерації інвайтів.
              </p>
            </div>

            <button
              onClick={handleDownloadSampleCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              Завантажити зразок шаблону (.csv)
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input area */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Завантажити файл .CSV
                </label>
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 text-center bg-slate-950 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="h-6 w-6 text-indigo-400 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-300 font-medium">Перетягніть CSV файл або натисніть для вибору</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Колонки: ПІБ, Email, Роль</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Або вставте текст таблиці безпосередньо:
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => parseCsvContent(e.target.value)}
                  placeholder="Олена Ковальчук, olena@company.ua, student&#10;Іван Мельник, ivan@company.ua, instructor"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Mode Selection */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Оберіть спосіб підключення:</span>
                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bulkMode"
                      checked={csvImportMode === "links"}
                      onChange={() => setCsvImportMode("links")}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-200">Масова генерація інвайтів (Рекомендовано)</span>
                      <p className="text-[11px] text-slate-400">
                        Створює унікальні посилання на 48 год для кожного працівника. Ви отримаєте таблицю посилань для розсилки.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bulkMode"
                      checked={csvImportMode === "direct"}
                      onChange={() => setCsvImportMode("direct")}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="font-semibold text-slate-200">Пряме створення акаунтів (Direct Provisioning)</span>
                      <p className="text-[11px] text-slate-400">
                        Миттєво додає користувачів до бази з автоматично згенерованими надійними паролями.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="button"
                disabled={importing || parsedRows.filter((r) => r.isValid).length === 0}
                onClick={handleRunBulkImport}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Виконується обробка списку...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Запустити Onboarding ({parsedRows.filter((r) => r.isValid).length} працівників)
                  </>
                )}
              </button>
            </div>

            {/* Preview table */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300">
                  Попередній перегляд списку ({parsedRows.length} рядків)
                </h4>
                {bulkResults && (
                  <button
                    onClick={handleExportResultsCsv}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Експортувати результати (.csv)
                  </button>
                )}
              </div>

              {bulkSummaryMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{bulkSummaryMessage}</span>
                </div>
              )}

              {/* Table or Results */}
              {bulkResults ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold sticky top-0">
                      <tr>
                        <th className="p-3">ПІБ</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Роль</th>
                        <th className="p-3">
                          {csvImportMode === "links" ? "Посилання (48 год)" : "Пароль"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {bulkResults.map((res, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition">
                          <td className="p-3 font-medium text-white">{res.name}</td>
                          <td className="p-3 font-mono text-slate-300">{res.email}</td>
                          <td className="p-3 text-indigo-400 font-semibold">{res.role}</td>
                          <td className="p-3">
                            {csvImportMode === "links" ? (
                              <button
                                onClick={() => copyToClipboard(res.inviteUrl || "")}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-mono flex items-center gap-1 transition"
                                title="Скопіювати посилання"
                              >
                                <Copy className="h-3 w-3" />
                                Копіювати лінк
                              </button>
                            ) : (
                              <span className="font-mono text-emerald-400 font-bold">
                                {res.password}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : parsedRows.length > 0 ? (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold sticky top-0">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">ПІБ</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Роль</th>
                        <th className="p-3">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition">
                          <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-3 font-medium text-white">{row.name}</td>
                          <td className="p-3 font-mono text-slate-300">{row.email}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 font-semibold">
                              {row.role}
                            </span>
                          </td>
                          <td className="p-3">
                            {row.isValid ? (
                              <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Валідно
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                                <AlertCircle className="h-3.5 w-3.5" /> {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-2">
                  <FileText className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Завантажте CSV або вставте список для попереднього перегляду.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE & USED INVITES */}
      {activeTab === "invites" && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                Історія та статус запрошень
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Керуйте згенерованими посиланнями для компанії {tenantSubdomain}.
              </p>
            </div>

            <button
              onClick={loadInvites}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Оновити список"
            >
              <RefreshCw className={`h-4 w-4 ${invitesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {invitesLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
              Завантаження запрошень...
            </div>
          ) : invites.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-2">
              <Link2 className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">Ще не згенеровано жодного запрошення.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3">Ціль / Тип</th>
                    <th className="p-3">Роль</th>
                    <th className="p-3">Використання</th>
                    <th className="p-3">Дійсне до</th>
                    <th className="p-3">Статус</th>
                    <th className="p-3 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {invites.map((inv) => {
                    const isExpired = new Date() > new Date(inv.expiresAt);
                    const isExhausted = inv.usesCount >= inv.maxUses;
                    const isRevoked = inv.isRevoked;
                    const isActive = !isExpired && !isExhausted && !isRevoked;

                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const fullLink = `${origin}/invite/${inv.token}?tenant=${inv.tenantSubdomain}`;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                        <td className="p-3">
                          {inv.email ? (
                            <span className="font-mono text-white font-medium">{inv.email}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                              Командне посилання
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-slate-300 capitalize">{inv.role}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {inv.usesCount} / {inv.maxUses}
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(inv.expiresAt).toLocaleString("uk-UA", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3">
                          {isRevoked ? (
                            <span className="text-rose-400 text-[11px] font-semibold">🚫 Відкликано</span>
                          ) : isExhausted ? (
                            <span className="text-amber-400 text-[11px] font-semibold">⏳ Використано</span>
                          ) : isExpired ? (
                            <span className="text-rose-400 text-[11px] font-semibold">🔴 Прострочено</span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] font-semibold">🟢 Активне</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isActive && (
                              <button
                                onClick={() => copyToClipboard(fullLink, false, inv.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition"
                                title="Скопіювати посилання"
                              >
                                {copiedInviteId === inv.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}

                            {!isRevoked && (
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                                title="Відкликати запрошення"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CURRENT EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                Зареєстровані працівники компанії
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Список користувачів в ізольованій схемі бази даних "{tenantSubdomain}".
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Пошук за ім'ям або email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
                />
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
              </div>

              <button
                onClick={loadEmployees}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Оновити список"
              >
                <RefreshCw className={`h-4 w-4 ${empLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {empLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
              Завантаження працівників...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-2">
              <Users className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">Співробітників не знайдено.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3">ПІБ</th>
                    <th className="p-3">Корпоративний Email</th>
                    <th className="p-3">Роль (RBAC)</th>
                    <th className="p-3">Бали ⭐</th>
                    <th className="p-3">Дата реєстрації</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/40 transition">
                      <td className="p-3 font-semibold text-white">{emp.name}</td>
                      <td className="p-3 font-mono text-slate-300">{emp.email}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            emp.role === "admin"
                              ? "bg-purple-950/60 border-purple-800 text-purple-300"
                              : emp.role === "instructor"
                              ? "bg-indigo-950/60 border-indigo-800 text-indigo-300"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                          }`}
                        >
                          {emp.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          ⭐ {emp.points}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(emp.createdAt).toLocaleDateString("uk-UA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
