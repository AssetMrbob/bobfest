"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ExternalLink, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAdmin } from "@/app/admin/actions";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Inbox", href: "/admin/inbox" },
  { label: "Publishing Queue", href: "/admin/queue" },
  { label: "Published", href: "/admin/published" },
  { label: "Templates", href: "/admin/templates" },
  { label: "Settings", href: "/admin/settings" },
];

export function AdminNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  const currentLabel = NAV_ITEMS.find((n) => n.href === pathname)?.label || "Admin";

  return (
    <>
      <header className="h-14 bg-[#FFFFFF] border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-[#737373] hover:text-[#171717] rounded-md transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-[#737373]">menfess.</span>
            <span className="text-[#A3A3A3]">/</span>
            <span className="text-[#171717]">{currentLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-14 z-50 bg-[#000000]/40 md:hidden flex flex-col">
          <div className="bg-[#FFFFFF] border-b border-[#E5E7EB] p-4 space-y-1 shadow-none">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-[#2563EB] text-[#FFFFFF]"
                      : "text-[#737373] hover:text-[#171717] hover:bg-[#FAFAFA]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-3 mt-2 border-t border-[#E5E7EB]">
              <Link
                href="/"
                className="flex items-center justify-between px-3 py-2 text-xs text-[#737373] hover:text-[#171717]"
              >
                <span>View Public Site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <div
            className="flex-1"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );
}
