"use client";

import React, { Suspense } from "react";
import { AppHeader } from "./AppHeader";

interface AppShellProps {
  children: React.ReactNode;
  currentTenant?: string;
  hideBottomPlayer?: boolean;
}

export function SpotifyShell({
  children,
  currentTenant,
}: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
        <AppHeader currentTenant={currentTenant} />
      </Suspense>

      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
