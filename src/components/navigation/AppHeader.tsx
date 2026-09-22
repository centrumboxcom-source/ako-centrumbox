"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Menu,
  Search,
  Sparkles,
  Trophy,
  Sliders,
  LogOut,
  ChevronDown,
  Shield,
  X,
  BookOpen,
  Server,
  Layers,
  LayoutGrid,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  points: number;
  tenantSubdomain: string;
  rank?: {
    title: string;
    badge: string;
  };
}

interface AppHeaderProps {
  currentTenant?: string;
  userOverride?: UserProfile | null;
  onToggleMobileSidebar?: () => void;
}

export function AppHeader({
  currentTenant: propTenant,
  userOverride,
  onToggleMobileSidebar,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTenant =
    propTenant ||
    searchParams.get("tenant") ||
    searchParams.get("__tenant") ||
    "";

  const [user, setUser] = useState<UserProfile | null>(userOverride || null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userOverride) {
      setUser(userOverride);
      return;
    }

    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data.authenticated && data.user) {
          const tenant = activeTenant || data.user.tenantSubdomain;
          if (tenant && tenant !== "master") {
            try {
              const pRes = await fetch(`/api/profile?tenant=${encodeURIComponent(tenant)}`, {
                headers: { "x-tenant-override": tenant },
                cache: "no-store",
              });
              const pData = await pRes.json();
              if (pData.success && pData.data?.user) {
                setUser(pData.data.user);
                return;
              }
            } catch {
              // fallback to session
            }
          }
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }

    fetchCurrentUser();
  }, [activeTenant, userOverride]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = "/login";
  };

  // Compute Page Title from Pathname
  const getPageTitle = () => {
    if (pathname === "/") return "Головна панель";
    if (pathname.startsWith("/learn")) return "Каталог курсів & Навчання";
    if (pathname.startsWith("/profile")) return "Мій профіль & Досягнення";
    if (pathname.startsWith("/admin")) return "HR Студія & Конструктор";
    if (pathname.startsWith("/superadmin")) return "Консоль Супер-Адміністратора";
    return "CENTRUMBOX AKO";
  };

  const isPlatformMaster = activeTenant === "master" || user?.tenantSubdomain === "master";
  const tenantParam = activeTenant && activeTenant !== "master"
    ? `?tenant=${encodeURIComponent(activeTenant)}`
    : "";

  return (
    <>
      <header className="sticky top-0 z-30 w-full h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* LEFT: Mobile Menu Toggle & Breadcrumbs / Page Title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {onToggleMobileSidebar && (
              <button
                type="button"
                onClick={onToggleMobileSidebar}
                className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden transition shrink-0"
                title="Відкрити меню"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {getPageTitle()}
              </h1>

              {activeTenant && (
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                  <span className="font-semibold text-[11px]">
                    {isPlatformMaster ? "master (public)" : activeTenant}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Search, Neon Status, Points Chip & User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Quick Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-xs text-slate-500 hover:text-slate-800 transition shadow-xs"
              title="Швидкий пошук (⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Пошук...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-400 font-semibold">
                ⌘K
              </kbd>
            </button>

            {/* Neon Cloud Active Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Neon Cloud Active</span>
            </div>

            {/* Points Chip (Clickable to Profile) */}
            {user && (
              <Link
                href={`/profile${tenantParam}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/60 hover:to-amber-100 border border-amber-200/80 text-amber-900 font-mono font-black text-xs shadow-xs transition hover:scale-102"
                title="Ваш баланс балів (перейти до кабінету)"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span>{user.points ?? 0}</span>
                <span className="text-[10px] text-amber-700 font-sans font-bold">б.</span>
              </Link>
            )}

            {/* User Profile Dropdown */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 transition"
                >
                  <div className="text-right hidden sm:block pr-1">
                    <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[140px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                      {user.role === "admin" ? (isPlatformMaster ? "Супер-Адмін" : "Адміністратор") : "Співробітник"}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 mr-1 transition-transform ${profileDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          user.role === "admin"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {user.role === "admin" ? (isPlatformMaster ? "Супер-Адмін" : "Адмін") : "Студент"}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          Бали: <strong>{user.points ?? 0}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <Link
                        href={`/profile${tenantParam}`}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                      >
                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        <span>Мій кабінет & Досягнення</span>
                      </Link>

                      {user.role === "admin" && (
                        <>
                          <Link
                            href={`/admin${tenantParam}`}
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                          >
                            <Sliders className="h-3.5 w-3.5 text-slate-500" />
                            <span>HR Панель & Конструктор</span>
                          </Link>

                          <Link
                            href="/superadmin"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
                          >
                            <Server className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Консоль Супер-Адміна ⚡</span>
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Вийти з акаунта</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm"
              >
                Увійти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-400 flex-1">
                <Search className="h-4 w-4 text-indigo-600 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Шукати курси, уроки, тестування..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-2 max-h-80 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Швидкі переходи
              </div>
              <Link
                href={`/learn${tenantParam}`}
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      Каталог призначених курсів та уроків
                    </h5>
                    <p className="text-[11px] text-slate-500">Перейти до проходження матеріалів</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-600">Відкрити →</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
