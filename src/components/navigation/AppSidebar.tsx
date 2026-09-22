"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  LayoutGrid,
  BookOpen,
  Trophy,
  Sliders,
  Server,
  Building2,
  ChevronDown,
  Check,
  Shield,
  LogOut,
  Sparkles,
  Layers,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  UserCheck,
  X,
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

interface AppSidebarProps {
  currentTenant?: string;
  userOverride?: UserProfile | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  currentTenant: propTenant,
  userOverride,
  isOpenMobile = false,
  onCloseMobile,
}: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTenant =
    propTenant ||
    searchParams.get("tenant") ||
    searchParams.get("__tenant") ||
    "";

  const [user, setUser] = useState<UserProfile | null>(userOverride || null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<
    Array<{ id: string; name: string; subdomain: string }>
  >([]);

  const tenantMenuRef = useRef<HTMLDivElement>(null);

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
          // Fetch profile points for active tenant
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
              // fallback to session user
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

  // Load available tenants for admin
  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/admin/tenants", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.tenants)) {
            setAvailableTenants(data.tenants);
          }
        })
        .catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
        setTenantDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTenantSwitch = (subdomain: string) => {
    setTenantDropdownOpen(false);
    if (onCloseMobile) onCloseMobile();
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
    window.location.href = "/login";
  };

  const isAdminOrInstructor = user?.role === "admin" || user?.role === "instructor";
  const isPlatformMaster = activeTenant === "master" || user?.tenantSubdomain === "master";

  const tenantParam = activeTenant && activeTenant !== "master"
    ? `?tenant=${encodeURIComponent(activeTenant)}`
    : "";

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpenMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* TOP SECTION: BRAND & TENANT SELECTOR */}
        <div className="p-4 space-y-4 border-b border-slate-100">
          {/* Logo & Mobile Close */}
          <div className="flex items-center justify-between">
            <Link
              href={`/${tenantParam}`}
              onClick={onCloseMobile}
              className="flex items-center gap-3 group"
            >
              <div className="h-10 w-10 rounded-2xl overflow-hidden shadow-md shadow-slate-200 border border-slate-200/80 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center bg-slate-900">
                <img
                  src="/logo.png"
                  alt="CENTRUMBOX"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-lg tracking-tight text-slate-900">
                    CENTRUM<span className="text-indigo-600">BOX</span>
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest">
                    AKO
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 block -mt-0.5">
                  Multi-Tenant LMS
                </span>
              </div>
            </Link>

            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden transition"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Tenant / Organization Capsule */}
          <div className="relative" ref={tenantMenuRef}>
            {user?.role === "admin" ? (
              <div>
                <button
                  type="button"
                  onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {isPlatformMaster ? "Платформа (Master)" : activeTenant.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        schema: "{isPlatformMaster ? "public" : activeTenant}"
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-transform ${tenantDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown Menu */}
                {tenantDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                      <span>Організації платформи</span>
                      <span className="font-mono text-emerald-600 font-semibold">Neon DB</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5 pt-1">
                      {availableTenants.length > 0 ? (
                        availableTenants.map((t) => (
                          <button
                            key={t.subdomain}
                            onClick={() => handleTenantSwitch(t.subdomain)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                              activeTenant === t.subdomain
                                ? "bg-indigo-50 text-indigo-600"
                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Building2 className="h-3.5 w-3.5 opacity-60 shrink-0" />
                              <span className="truncate">{t.name}</span>
                            </div>
                            {activeTenant === t.subdomain && (
                              <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          <p>Компаній ще не створено.</p>
                          <Link
                            href="/superadmin"
                            onClick={() => {
                              setTenantDropdownOpen(false);
                              if (onCloseMobile) onCloseMobile();
                            }}
                            className="mt-1 inline-block font-bold text-indigo-600 hover:underline"
                          >
                            Створити в Консолі →
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <Link
                        href="/superadmin"
                        onClick={() => {
                          setTenantDropdownOpen(false);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                      >
                        <Server className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Консоль Супер-Адміна</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {activeTenant ? activeTenant.toUpperCase() : "CENTRUMBOX"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block truncate">
                    Корпоративний простір
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE SECTION: BEAUTIFULLY STYLED SIDEBAR NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* GROUP 1: НАВЧАННЯ */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Навчальний простір
            </div>

            <Link
              href={`/${tenantParam}`}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                pathname === "/"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <LayoutGrid className={`h-4 w-4 ${pathname === "/" ? "text-white" : "text-slate-400 group-hover:text-indigo-600"}`} />
              <span className="flex-1">Головна панель</span>
              {pathname === "/" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>

            <Link
              href={`/learn${tenantParam}`}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                pathname.startsWith("/learn")
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <BookOpen className={`h-4 w-4 ${pathname.startsWith("/learn") ? "text-white" : "text-slate-400 group-hover:text-indigo-600"}`} />
              <span className="flex-1">Мої курси & Уроки</span>
              {pathname.startsWith("/learn") && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>

            <Link
              href={`/profile${tenantParam}`}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                pathname.startsWith("/profile")
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Trophy className={`h-4 w-4 ${pathname.startsWith("/profile") ? "text-white" : "text-amber-500"}`} />
              <span className="flex-1">Профіль & Рейтинг</span>
              {pathname.startsWith("/profile") && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>
          </div>

          {/* GROUP 2: УПРАВЛІННЯ ТА НАЛАШТУВАННЯ (ADMIN / INSTRUCTOR) */}
          {isAdminOrInstructor && (
            <div className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Управління</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  HR / ADMIN
                </span>
              </div>

              <Link
                href={`/admin${tenantParam}`}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                  pathname.startsWith("/admin")
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Sliders className={`h-4 w-4 ${pathname.startsWith("/admin") ? "text-white" : "text-slate-400 group-hover:text-indigo-600"}`} />
                <span className="flex-1">HR Студія & Конструктор</span>
                {pathname.startsWith("/admin") && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </Link>

              {user?.role === "admin" && (
                <Link
                  href="/superadmin"
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group border ${
                    pathname.startsWith("/superadmin")
                      ? "bg-slate-900 text-white border-slate-900 shadow-md"
                      : "bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-900 border-indigo-200/80"
                  }`}
                >
                  <Server className="h-4 w-4 text-indigo-600" />
                  <div className="flex-1">
                    <span>Консоль Супер-Адміна</span>
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white shadow-xs">
                    ⚡
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* Gamification Points Widget Card */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  Бали прогресу
                </span>
                <span className="text-xs font-mono font-black text-amber-800">
                  {user.points ?? 0} б.
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Ранг:</span>
                <span className="font-bold text-slate-900">
                  {user.rank?.title || (user.role === "admin" ? "Адміністратор" : "Спеціаліст")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: USER PROFILE & QUICK LOGOUT */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {user ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
              <Link
                href={`/profile${tenantParam}`}
                onClick={onCloseMobile}
                className="flex items-center gap-2.5 min-w-0 flex-1 group"
              >
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-600 transition">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate block font-medium">
                    {user.email}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                title="Вийти з акаунта"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={onCloseMobile}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Увійти до акаунта</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
