"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Search,
  BookOpen,
  Trophy,
  Sliders,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  Shield,
  Box,
  LayoutGrid,
  X,
  Layers,
  Server,
  LogIn,
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
}

export function AppHeader({ currentTenant: propTenant, userOverride }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTenant =
    propTenant ||
    searchParams.get("tenant") ||
    searchParams.get("__tenant") ||
    "acme";

  const [user, setUser] = useState<UserProfile | null>(userOverride || null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableTenants, setAvailableTenants] = useState<Array<{ id: string; name: string; subdomain: string }>>([
    { id: "1", name: "Acme Corporation", subdomain: "acme" },
    { id: "2", name: "Globex Industries", subdomain: "globex" },
    { id: "3", name: "Nova Tech Labs", subdomain: "nova" },
  ]);

  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userOverride) {
      setUser(userOverride);
      return;
    }

    async function fetchCurrentUser() {
      try {
        const res = await fetch(`/api/profile?tenant=${encodeURIComponent(activeTenant)}`, {
          headers: { "x-tenant-override": activeTenant },
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok && data.success && data.data?.user) {
          setUser(data.data.user);
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
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
        setTenantDropdownOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTenantSwitch = (subdomain: string) => {
    setTenantDropdownOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", subdomain);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // ignore
    }
    setUser(null);
    setProfileDropdownOpen(false);
    window.location.href = `/login?tenant=${encodeURIComponent(activeTenant)}`;
  };

  const isAdminOrInstructor = user?.role === "admin" || user?.role === "instructor";

  const navLinks = [
    {
      name: "Головна",
      href: `/?tenant=${encodeURIComponent(activeTenant)}`,
      icon: LayoutGrid,
      active: pathname === "/",
    },
    {
      name: "Мої курси & Уроки",
      href: `/learn?tenant=${encodeURIComponent(activeTenant)}`,
      icon: BookOpen,
      active: pathname.startsWith("/learn"),
    },
    {
      name: "Профіль & Рейтинг",
      href: `/profile?tenant=${encodeURIComponent(activeTenant)}`,
      icon: Trophy,
      active: pathname.startsWith("/profile"),
    },
    ...(isAdminOrInstructor
      ? [
          {
            name: "HR Студія",
            href: `/admin?tenant=${encodeURIComponent(activeTenant)}`,
            icon: Sliders,
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo: CENTRUMBOX AKO */}
          <div className="flex items-center gap-5 sm:gap-6">
            <Link
              href={`/?tenant=${encodeURIComponent(activeTenant)}`}
              className="flex items-center gap-2.5 group"
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Box className="h-5 w-5" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-lg sm:text-xl tracking-tight text-slate-900">
                  CENTRUM<span className="text-indigo-600">BOX</span>
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest">
                  AKO
                </span>
              </div>
            </Link>

            {/* Tenant Capsule: Dropdown for Admin, Scoped Pill for Students */}
            {user?.role === "admin" ? (
              <div className="relative" ref={tenantMenuRef}>
                <button
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition"
                  title="Переключити простір організації (Admin Only)"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                  <span className="uppercase tracking-wider font-mono text-[11px]">{activeTenant}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {tenantDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Організація (Tenant Схема)
                    </div>
                    {availableTenants.map((t) => (
                      <button
                        key={t.subdomain}
                        onClick={() => handleTenantSwitch(t.subdomain)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          activeTenant === t.subdomain
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 opacity-60" />
                          <span>{t.name}</span>
                        </div>
                        {activeTenant === t.subdomain && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                      </button>
                    ))}
                    <div className="p-2 mt-1 border-t border-slate-100 text-[10px] text-emerald-600 flex items-center gap-1.5">
                      <Shield className="h-3 w-3" />
                      <span>Neon PostgreSQL Ізоляція</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                <span className="uppercase tracking-wider font-mono text-[11px]">{activeTenant}</span>
              </div>
            )}

            {/* Platform Super Admin Console Link */}
            {user?.role === "admin" && (
              <Link
                href="/superadmin"
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
                title="Головна консоль суперадміністратора"
              >
                <Server className="h-3.5 w-3.5 text-indigo-400" />
                <span>Супер-Адмін</span>
              </Link>
            )}
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-slate-100/80 border border-slate-200/80">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    link.active
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Search, Points Chip, User Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs text-slate-500 hover:text-slate-800 transition"
              title="Пошук курсів"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Пошук...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
                ⌘K
              </kbd>
            </button>

            {/* Points Chip & User Dropdown if authenticated */}
            {user ? (
              <>
                <Link
                  href={`/profile?tenant=${encodeURIComponent(activeTenant)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-800 font-mono font-bold text-xs shadow-sm transition hover:scale-105"
                  title="Ваш баланс балів"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>{user.points ?? 0}</span>
                  <span className="text-[10px] text-amber-600 font-sans font-bold">б.</span>
                </Link>

                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 p-1 pl-2 rounded-full bg-slate-100 hover:bg-slate-200/70 border border-slate-200 transition"
                  >
                    <div className="text-right hidden sm:block pr-1">
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                        {user.rank?.title || "Спеціаліст"}
                      </span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2.5 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                            user.role === "admin"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : user.role === "instructor"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {user.role === "admin" ? "Адміністратор" : user.role === "instructor" ? "Інструктор" : "Співробітник"}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            Бали: <strong>{user.points ?? 0}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="py-1.5 space-y-0.5">
                        <Link
                          href={`/profile?tenant=${encodeURIComponent(activeTenant)}`}
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                        >
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                          <span>Мій профіль & Досягнення</span>
                        </Link>
                        <Link
                          href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Каталог курсів та уроків</span>
                        </Link>
                        {isAdminOrInstructor && (
                          <>
                            <Link
                              href={`/admin?tenant=${encodeURIComponent(activeTenant)}`}
                              onClick={() => setProfileDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                            >
                              <Sliders className="h-3.5 w-3.5 text-slate-500" />
                              <span>HR Панель & Конструктор</span>
                            </Link>
                            {user.role === "admin" && (
                              <Link
                                href="/superadmin"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
                              >
                                <Server className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Консоль Супер-Адміна ⚡</span>
                              </Link>
                            )}
                          </>
                        )}
                      </div>

                      <div className="pt-1.5 border-t border-slate-100">
                        <button
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
              </>
            ) : (
              <Link
                href={`/login?tenant=${encodeURIComponent(activeTenant)}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Увійти в акаунт</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Global Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl p-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 flex-1">
                <Search className="h-4 w-4 text-indigo-600" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Шукати уроки, курси, тести (наприклад: Multi-tenant, RBAC)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400 w-full"
                />
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-2 max-h-80 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Рекомендовані матеріали
              </div>
              <Link
                href={`/learn?tenant=${encodeURIComponent(activeTenant)}`}
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      Основи веб-розробки та безпеки 2026
                    </h5>
                    <p className="text-[11px] text-slate-500">2 модулі • Контрольний тест • +50 балів</p>
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
