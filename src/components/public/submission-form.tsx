"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_RULES } from "@/lib/constants";
import { FormSubmissionState, FormErrors } from "@/lib/types/submission";
import { TurnstileWidget } from "@/components/public/turnstile-widget";
import { MediaAttachment, UploadedMediaData } from "@/components/public/media-attachment";

interface SlideState {
  message: string;
  mediaAttachment: UploadedMediaData | null;
  hasMediaPermission: boolean;
}

export function SubmissionForm() {
  const [recipient, setRecipient] = React.useState("");
  const [slide1, setSlide1] = React.useState<SlideState>({
    message: "",
    mediaAttachment: null,
    hasMediaPermission: false,
  });
  const [hasSecondSlide, setHasSecondSlide] = React.useState(false);
  const [slide2, setSlide2] = React.useState<SlideState>({
    message: "",
    mediaAttachment: null,
    hasMediaPermission: false,
  });

  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [isMediaUploading, setIsMediaUploading] = React.useState(false);
  const [formState, setFormState] = React.useState<FormSubmissionState>("idle");
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [publicCode, setPublicCode] = React.useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate Slide 1
    const s1Trimmed = slide1.message.trim();
    if (!s1Trimmed) {
      newErrors.message = "Slide 1 message cannot be empty.";
    } else if (s1Trimmed.length > BUSINESS_RULES.maxCharacterCount) {
      newErrors.message = `Slide 1 exceeds ${BUSINESS_RULES.maxCharacterCount} characters.`;
    }

    if (slide1.mediaAttachment && !slide1.hasMediaPermission) {
      newErrors.general = "You must confirm permission for Slide 1 media.";
    }

    // Validate Slide 2 if enabled
    if (hasSecondSlide) {
      const s2Trimmed = slide2.message.trim();
      if (!s2Trimmed) {
        newErrors.general = "Slide 2 message cannot be empty if second slide is added.";
      } else if (s2Trimmed.length > BUSINESS_RULES.maxCharacterCount) {
        newErrors.general = `Slide 2 exceeds ${BUSINESS_RULES.maxCharacterCount} characters.`;
      }

      if (slide2.mediaAttachment && !slide2.hasMediaPermission) {
        newErrors.general = "You must confirm permission for Slide 2 media.";
      }
    }

    if (recipient.trim().length > 100) {
      newErrors.recipient = "Recipient cannot exceed 100 characters.";
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

    const slidesPayload: Array<{
      slideOrder: 1 | 2;
      message: string;
      mediaAttachment?: UploadedMediaData;
    }> = [
      {
        slideOrder: 1,
        message: slide1.message.trim(),
        mediaAttachment: slide1.mediaAttachment || undefined,
      },
    ];

    if (hasSecondSlide && slide2.message.trim()) {
      slidesPayload.push({
        slideOrder: 2,
        message: slide2.message.trim(),
        mediaAttachment: slide2.mediaAttachment || undefined,
      });
    }

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: recipient.trim() || undefined,
          // Support both legacy single message and multi-slide
          message: slide1.message.trim(),
          mediaAttachment: slide1.mediaAttachment || undefined,
          slides: slidesPayload,
          turnstileToken: turnstileToken || undefined,
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
    setSlide1({ message: "", mediaAttachment: null, hasMediaPermission: false });
    setSlide2({ message: "", mediaAttachment: null, hasMediaPermission: false });
    setHasSecondSlide(false);
    setErrors({});
    setPublicCode(null);
    setFormState("idle");
  };

  return (
    <div className="w-full">
      {formState === "success" && (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-5 text-center">
          <div className="w-12 h-12 bg-[#EFF6FF] text-[#2563EB] rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#171717]">
              Submission Received
            </h2>
            <p className="text-xs text-[#737373]">
              Your confession is queued for moderation and scheduled publication.
            </p>
          </div>

          {publicCode && (
            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 max-w-xs mx-auto">
              <span className="text-[11px] font-mono text-[#737373] uppercase tracking-wider block mb-1">
                Reference Code
              </span>
              <span className="text-base font-mono font-bold text-[#171717] select-all">
                {publicCode}
              </span>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleReset}
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
            >
              Send Another
            </Button>
          </div>
        </div>
      )}

      {formState !== "success" && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Recipient Input (Optional) */}
          <div className="space-y-1.5">
            <label
              htmlFor="recipient"
              className="block text-xs font-semibold text-[#171717]"
            >
              To <span className="text-[#737373] font-normal">(Optional)</span>
            </label>
            <Input
              id="recipient"
              type="text"
              placeholder="e.g. Someone in Computer Science 2024"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={formState === "submitting"}
              maxLength={100}
              className="h-11 sm:h-10 text-base sm:text-xs"
            />
            {errors.recipient && (
              <span className="text-xs text-[#DC2626]">{errors.recipient}</span>
            )}
          </div>

          {/* SLIDE 1 CARD */}
          <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E5E7EB]">
              <span className="font-semibold text-[#171717]">Slide 1</span>
              <span className="text-[11px] font-mono text-[#737373]">
                {slide1.message.length} / 500
              </span>
            </div>

            <Textarea
              id="slide1-message"
              placeholder="Write your first slide message here..."
              value={slide1.message}
              onChange={(e) =>
                setSlide1((prev) => ({ ...prev, message: e.target.value }))
              }
              disabled={formState === "submitting"}
              maxLength={500}
              rows={4}
              className="text-base sm:text-xs bg-[#FFFFFF]"
            />
            {errors.message && (
              <span className="text-xs text-[#DC2626]">{errors.message}</span>
            )}

            <MediaAttachment
              onMediaReady={(media: UploadedMediaData | null) =>
                setSlide1((prev) => ({
                  ...prev,
                  mediaAttachment: media,
                  hasMediaPermission: media ? prev.hasMediaPermission : false,
                }))
              }
              onUploadingChange={setIsMediaUploading}
              disabled={formState === "submitting"}
            />
            {slide1.mediaAttachment && (
              <label className="flex items-center gap-2 text-xs text-[#737373] mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slide1.hasMediaPermission}
                  onChange={(e) =>
                    setSlide1((prev) => ({ ...prev, hasMediaPermission: e.target.checked }))
                  }
                  className="rounded border-[#E5E7EB] text-[#2563EB]"
                />
                <span>I confirm I have permission to share this media.</span>
              </label>
            )}
          </div>

          {/* SLIDE 2 CARD (Expandable) */}
          {hasSecondSlide ? (
            <div className="bg-[#FAFAFA] border border-[#2563EB]/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#171717]">Slide 2</span>
                  <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded font-medium">
                    Carousel Post
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-[#737373]">
                    {slide2.message.length} / 500
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHasSecondSlide(false);
                      setSlide2({
                        message: "",
                        mediaAttachment: null,
                        hasMediaPermission: false,
                      });
                    }}
                    className="text-[#DC2626] hover:text-[#B91C1C] text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Slide</span>
                  </button>
                </div>
              </div>

              <Textarea
                id="slide2-message"
                placeholder="Write continuation on slide 2..."
                value={slide2.message}
                onChange={(e) =>
                  setSlide2((prev) => ({ ...prev, message: e.target.value }))
                }
                disabled={formState === "submitting"}
                maxLength={500}
                rows={4}
                className="text-base sm:text-xs bg-[#FFFFFF]"
              />

              <MediaAttachment
                onMediaReady={(media: UploadedMediaData | null) =>
                  setSlide2((prev) => ({
                    ...prev,
                    mediaAttachment: media,
                    hasMediaPermission: media ? prev.hasMediaPermission : false,
                  }))
                }
                onUploadingChange={setIsMediaUploading}
                disabled={formState === "submitting"}
              />
              {slide2.mediaAttachment && (
                <label className="flex items-center gap-2 text-xs text-[#737373] mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slide2.hasMediaPermission}
                    onChange={(e) =>
                      setSlide2((prev) => ({ ...prev, hasMediaPermission: e.target.checked }))
                    }
                    className="rounded border-[#E5E7EB] text-[#2563EB]"
                  />
                  <span>I confirm I have permission to share this media.</span>
                </label>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHasSecondSlide(true)}
              className="w-full py-2.5 border border-dashed border-[#D1D5DB] hover:border-[#2563EB] bg-[#FAFAFA] hover:bg-[#EFF6FF]/40 rounded-xl text-xs font-medium text-[#737373] hover:text-[#2563EB] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Slide 2 (Optional Carousel)</span>
            </button>
          )}

          {/* Cloudflare Turnstile */}
          <div className="pt-1">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={formState === "submitting" || isMediaUploading}
            className="w-full h-12 text-sm font-semibold"
          >
            {formState === "submitting"
              ? "Submitting..."
              : isMediaUploading
              ? "Uploading attachment..."
              : "Send Menfess"}
          </Button>

          <p className="text-[11px] text-[#737373] text-center leading-relaxed">
            Submissions are anonymous and processed with privacy-first automated moderation before scheduled publication at 12:00 or 19:00 WIB.
          </p>
        </form>
      )}
    </div>
  );
}
