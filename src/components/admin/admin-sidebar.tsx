"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Clock,
  CheckCircle,
  Palette,
  Settings,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Inbox", href: "/admin/inbox", icon: Inbox },
  { label: "Publishing Queue", href: "/admin/queue", icon: Clock },
  { label: "Published", href: "/admin/published", icon: CheckCircle },
  { label: "Templates", href: "/admin/templates", icon: Palette },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-[#FFFFFF] border-r border-[#E5E7EB] shrink-0 min-h-dvh">
      {/* Brand Header */}
      <div className="h-14 px-6 flex items-center border-b border-[#E5E7EB] justify-between">
        <Link href="/admin" className="text-base font-semibold tracking-tight text-[#171717]">
          menfess<span className="text-[#2563EB]">.</span>
          <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-[#737373] px-1.5 py-0.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded">
            Admin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-[8px] transition-colors",
                isActive
                  ? "bg-[#2563EB] text-[#FFFFFF]"
                  : "text-[#737373] hover:text-[#171717] hover:bg-[#FAFAFA]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Portal Status & Public Link */}
      <div className="p-4 border-t border-[#E5E7EB] space-y-3">
        <div className="flex items-start gap-2 p-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-[11px] text-[#737373]">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-[#2563EB] mt-0.5" />
          <span>Protected Portal · Supabase Auth & RLS Enforced</span>
        </div>
        <Link
          href="/"
          className="flex items-center justify-between text-xs text-[#737373] hover:text-[#171717] px-2 py-1 transition-colors"
        >
          <span>View Public Site</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </aside>
  );
}
