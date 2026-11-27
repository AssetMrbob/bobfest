import Link from "next/link";
import { InstagramIcon } from "@/components/ui/icons";
import { APP_CONFIG } from "@/lib/constants";

export function Header() {
  return (
    <header className="w-full border-b border-[#E5E7EB] bg-[#FFFFFF] sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Wordmark with blue period (min 44px touch height) */}
        <Link
          href="/"
          className="min-h-[44px] inline-flex items-center text-base sm:text-lg font-semibold tracking-tight text-[#171717] hover:opacity-90 transition-opacity"
        >
          Kampung Inggris Fess<span className="text-[#2563EB]">.</span>
        </Link>

        {/* Minimal navigation with 44px touch targets */}
        <nav className="flex items-center gap-1 sm:gap-4 text-xs tracking-tight text-[#737373]">
          <Link
            href="/admin"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 py-1 hover:text-[#171717] transition-colors"
          >
            Admin
          </Link>
          <a
            href={APP_CONFIG.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram profile"
            className="min-h-[44px] inline-flex items-center gap-1.5 px-2 py-1 hover:text-[#171717] transition-colors"
          >
            <InstagramIcon className="w-4 h-4 text-[#171717]" />
            <span className="hidden sm:inline">@{APP_CONFIG.instagramHandle}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
