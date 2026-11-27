"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Clock, CheckCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Inbox", href: "/admin/inbox", icon: Inbox },
  { label: "Queue", href: "/admin/queue", icon: Clock },
  { label: "Published", href: "/admin/published", icon: CheckCircle },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E5E7EB] px-2 pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around h-14">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] transition-colors",
                isActive ? "text-[#2563EB]" : "text-[#737373] hover:text-[#171717]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
