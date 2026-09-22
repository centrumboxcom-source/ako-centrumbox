"use client";

import React, { useState, Suspense } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

interface AppShellProps {
  children: React.ReactNode;
  currentTenant?: string;
  hideBottomPlayer?: boolean;
}

export function SpotifyShell({
  children,
  currentTenant,
}: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      {/* Sleek Modern Left Sidebar */}
      <Suspense fallback={<div className="hidden md:block w-72 border-r border-slate-200 bg-white" />}>
        <AppSidebar
          currentTenant={currentTenant}
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      </Suspense>

      {/* Main App Container (offset for fixed sidebar on desktop) */}
      <div className="flex-1 flex flex-col md:pl-72 min-w-0">
        {/* Beautiful, Airy Top Header */}
        <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
          <AppHeader
            currentTenant={currentTenant}
            onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          />
        </Suspense>

        {/* Page Content Area */}
        <main className="flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}
