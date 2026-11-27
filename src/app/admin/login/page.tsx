"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ArrowLeft, AlertCircle, ShieldCheck } from "lucide-react";
import { signInAdmin } from "@/app/admin/actions";

export default function AdminLoginPage() {
  const [email, setEmail] = React.useState("admin@menfess.id");
  const [password, setPassword] = React.useState("admin12345");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    const result = await signInAdmin(formData);
    if (result && result.error) {
      setError(result.error);
      setIsLoading(false);
    }
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

        {/* Security / Provisioning Notice */}
        <div className="mb-4 p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs text-[#737373] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#2563EB] mt-0.5" />
          <p>
            Secured via Supabase Auth. Public registration is disabled. Only pre-provisioned administrators in <code>admin_profiles</code> can authenticate.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-[#171717] mb-1.5"
            >
              Email Address
            </label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-xs"
              placeholder="admin@domain.com"
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
