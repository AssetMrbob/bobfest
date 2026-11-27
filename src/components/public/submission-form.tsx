"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_RULES } from "@/lib/constants";
import { FormSubmissionState, FormErrors } from "@/lib/types/submission";
import { TurnstileWidget } from "@/components/public/turnstile-widget";
import { MediaAttachment, UploadedMediaData } from "@/components/public/media-attachment";

export function SubmissionForm() {
  const [recipient, setRecipient] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [formState, setFormState] = React.useState<FormSubmissionState>("idle");
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [publicCode, setPublicCode] = React.useState<string | null>(null);
  const [mediaAttachment, setMediaAttachment] = React.useState<UploadedMediaData | null>(null);
  const [isMediaUploading, setIsMediaUploading] = React.useState(false);
  const [hasMediaPermission, setHasMediaPermission] = React.useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const trimmed = message.trim();
    if (!trimmed) {
      newErrors.message = "Message cannot be empty.";
    } else if (trimmed.length > BUSINESS_RULES.maxCharacterCount) {
      newErrors.message = `Message exceeds ${BUSINESS_RULES.maxCharacterCount} characters.`;
    }

    if (recipient.trim().length > 100) {
      newErrors.recipient = "Recipient cannot exceed 100 characters.";
    }

    if (mediaAttachment && !hasMediaPermission) {
      newErrors.general = "You must confirm you have permission to share this media.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setFormState("submitting");
    setErrors({});

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: recipient.trim() || undefined,
          message: message.trim(),
          turnstileToken: turnstileToken || undefined,
          mediaAttachment: mediaAttachment || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormState("error");
        setErrors({
          general: data.error || "Failed to submit message. Please try again.",
        });
        return;
      }

      setPublicCode(data.publicCode || null);
      setFormState("success");
    } catch {
      setFormState("error");
      setErrors({
        general: "Network error. Please check your connection and try again.",
      });
    }
  };

  const handleReset = () => {
    setRecipient("");
    setMessage("");
    setErrors({});
    setPublicCode(null);
    setFormState("idle");
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);
    if (formState === "idle" || formState === "error") {
      setFormState("typing");
    }
    if (errors.message && val.trim().length > 0 && val.length <= BUSINESS_RULES.maxCharacterCount) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.message;
        return next;
      });
    }
  };

  // SUCCESS STATE
  if (formState === "success") {
    return (
      <div className="w-full bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-6 sm:p-10 text-center animate-in fade-in duration-300">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center mb-4 text-[#2563EB]">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] mb-2">
          Message sent.
        </h2>
        <p className="text-xs sm:text-sm text-[#737373] max-w-sm mx-auto mb-4 leading-relaxed">
          Your message is awaiting moderation.
        </p>

        {publicCode && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs font-mono text-[#171717] mb-6">
            <span className="text-[#737373]">Reference:</span>
            <strong className="font-semibold">{publicCode}</strong>
          </div>
        )}

        <div className="pt-2">
          <Button
            onClick={handleReset}
            variant="primary"
            size="md"
            className="w-full sm:w-auto h-11"
          >
            Send another
          </Button>
        </div>
      </div>
    );
  }

  const charCount = message.length;
  const isOverLimit = charCount > BUSINESS_RULES.maxCharacterCount;

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4 sm:p-7 space-y-4 sm:space-y-5"
      >
        {/* General Error Banner */}
        {formState === "error" && errors.general && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg text-xs text-[#991B1B] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
            <div className="flex-1">
              <p className="font-medium">{errors.general}</p>
              <button
                type="button"
                onClick={() => setFormState("idle")}
                className="mt-1 text-xs text-[#DC2626] underline font-medium hover:text-[#991B1B] min-h-[32px] inline-flex items-center"
              >
                Dismiss and edit
              </button>
            </div>
          </div>
        )}

        {/* Recipient Field */}
        <div>
          <label
            htmlFor="recipient-input"
            className="block text-xs font-medium text-[#171717] mb-1.5"
          >
            To <span className="text-[#A3A3A3] font-normal">(optional)</span>
          </label>
          <Input
            id="recipient-input"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Someone, maybe?"
            disabled={formState === "submitting"}
            maxLength={100}
            autoComplete="off"
          />
          {errors.recipient && (
            <p className="mt-1.5 text-xs text-[#EF4444]">{errors.recipient}</p>
          )}
        </div>

        {/* Message Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="message-textarea"
              className="block text-xs font-medium text-[#171717]"
            >
              Your message <span className="text-[#EF4444]">*</span>
            </label>
            <span
              className={`text-[11px] font-mono tabular-nums ${
                isOverLimit ? "text-[#EF4444] font-semibold" : "text-[#737373]"
              }`}
              aria-live="polite"
            >
              {charCount}/{BUSINESS_RULES.maxCharacterCount}
            </span>
          </div>

          <Textarea
            id="message-textarea"
            rows={4}
            value={message}
            onChange={handleMessageChange}
            placeholder="Write something..."
            error={!!errors.message || isOverLimit}
            disabled={formState === "submitting"}
            className="leading-relaxed"
          />

          {errors.message && (
            <p className="mt-1.5 text-xs text-[#EF4444] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.message}
            </p>
          )}
        </div>

        {/* Functional Media Attachment Selector */}
        <MediaAttachment
          onMediaReady={(media) => setMediaAttachment(media)}
          onUploadingChange={(uploading) => setIsMediaUploading(uploading)}
          disabled={formState === "submitting"}
        />

        {/* Media rights checkbox when attachment is present */}
        {mediaAttachment && (
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={hasMediaPermission}
              onChange={(e) => setHasMediaPermission(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]"
            />
            <span className="text-[11px] text-[#737373] leading-relaxed">
              I confirm I hold the rights or have permission to share this media, and it complies with community guidelines.
            </span>
          </label>
        )}

        {/* Cloudflare Turnstile Bot Defense Widget */}
        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken("")}
        />

        {/* Submit Button (48px height on mobile for primary thumb action) */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={formState === "submitting" || isMediaUploading}
            disabled={formState === "submitting" || isMediaUploading || isOverLimit}
            className="w-full text-base font-medium h-12"
          >
            Send anonymously
          </Button>
        </div>
      </form>
    </div>
  );
}
