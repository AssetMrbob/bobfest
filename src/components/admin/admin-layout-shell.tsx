"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./admin-sidebar";
import { AdminNavbar } from "./admin-navbar";
import { AdminBottomNav } from "./admin-bottom-nav";

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-[#FFFFFF] text-[#171717]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <AdminNavbar />
        <main className="flex-1 p-3.5 sm:p-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
        <AdminBottomNav />
      </div>
    </div>
  );
}
