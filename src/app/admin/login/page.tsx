"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("••••••••");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsLoading(false);
    router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-[#171717]"
          >
            menfess<span className="text-[#2563EB]">.</span>
          </Link>
          <p className="text-xs text-[#737373] mt-1">
            Editorial & Moderation Portal
          </p>
        </div>

        {/* Mock Notice */}
        <div className="mb-4 p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs text-[#737373] flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-[#2563EB] mt-0.5" />
          <p>
            Phase 01 Mock Mode: Authentication is simulated. Click Sign In to access the admin dashboard.
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-medium text-[#171717] mb-1.5"
            >
              Username
            </label>
            <Input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-[#171717] mb-1.5"
            >
              Password
            </label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full text-xs font-medium"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            Sign In to Dashboard
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to public submission page</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
