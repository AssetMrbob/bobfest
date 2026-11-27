"use client";

import * as React from "react";
import { Image as ImageIcon, Video, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_RULES } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";
import { FormSubmissionState, FormErrors } from "@/lib/types/submission";

interface MediaPreviewItem {
  file: File;
  previewUrl: string;
  type: "image" | "video";
}

export function SubmissionForm() {
  const [recipient, setRecipient] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [media, setMedia] = React.useState<MediaPreviewItem | null>(null);
  const [formState, setFormState] = React.useState<FormSubmissionState>("idle");
  const [errors, setErrors] = React.useState<FormErrors>({});
  
  // Test control: allows toggling simulated mock failure
  const [simulateError, setSimulateError] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Safely cleanup preview object URLs to avoid memory leaks
  const cleanupPreview = React.useCallback(() => {
    if (media?.previewUrl) {
      URL.revokeObjectURL(media.previewUrl);
    }
  }, [media]);

  // Cleanup on unmount or media change
  React.useEffect(() => {
    return () => {
      if (media?.previewUrl) {
        URL.revokeObjectURL(media.previewUrl);
      }
    };
  }, [media]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrors((prev) => ({
        ...prev,
        media: "Unsupported file type. Use JPG, PNG, WEBP, or MP4.",
      }));
      return;
    }

    if (isImage && file.size > BUSINESS_RULES.maxImageSizeBytes) {
      setErrors((prev) => ({
        ...prev,
        media: `Image exceeds maximum ${BUSINESS_RULES.maxImageSizeMB}MB limit (${formatBytes(file.size)}).`,
      }));
      return;
    }

    if (isVideo && file.size > BUSINESS_RULES.maxVideoSizeBytes) {
      setErrors((prev) => ({
        ...prev,
        media: `Video exceeds maximum ${BUSINESS_RULES.maxVideoSizeMB}MB limit (${formatBytes(file.size)}).`,
      }));
      return;
    }

    cleanupPreview();
    const previewUrl = URL.createObjectURL(file);
    setMedia({
      file,
      previewUrl,
      type: isImage ? "image" : "video",
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next.media;
      return next;
    });
  };

  const removeMedia = () => {
    cleanupPreview();
    setMedia(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.media;
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const trimmed = message.trim();
    if (!trimmed) {
      newErrors.message = "Message cannot be empty.";
    } else if (trimmed.length > BUSINESS_RULES.maxCharacterCount) {
      newErrors.message = `Message exceeds ${BUSINESS_RULES.maxCharacterCount} characters.`;
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

    // Simulate mock network latency for Phase 01
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (simulateError) {
      setFormState("error");
      setErrors({
        general: "Failed to submit message. (Simulated mock failure for testing).",
      });
      return;
    }

    // Mock success
    setFormState("success");
  };

  const handleReset = () => {
    cleanupPreview();
    setRecipient("");
    setMessage("");
    setMedia(null);
    setErrors({});
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
      <div className="w-full bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-8 sm:p-10 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center mb-4 text-[#2563EB]">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-[#171717] mb-2">
          Message sent.
        </h2>
        <p className="text-sm text-[#737373] max-w-sm mx-auto mb-6 leading-relaxed">
          Your message is awaiting moderation.
        </p>
        <p className="text-xs text-[#A3A3A3] mb-6">
          Phase 01 Mock Submission: Simulated local success state.
        </p>
        <Button
          onClick={handleReset}
          variant="primary"
          size="md"
          className="w-full sm:w-auto"
        >
          Send another
        </Button>
      </div>
    );
  }

  const charCount = message.length;
  const isOverLimit = charCount > BUSINESS_RULES.maxCharacterCount;

  return (
    <div className="w-full">
      {/* Dev Mode Banner */}
      <div className="mb-4 px-3 py-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg flex items-center justify-between text-xs text-[#737373]">
        <span>Phase 01 Mock Mode (No persistent database write)</span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-[#171717]">
          <input
            type="checkbox"
            checked={simulateError}
            onChange={(e) => setSimulateError(e.target.checked)}
            className="rounded border-[#E5E7EB] text-[#2563EB] focus:ring-[#2563EB]"
          />
          Simulate failure
        </label>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-6 sm:p-7 space-y-5"
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
                className="mt-1 text-xs text-[#DC2626] underline font-medium hover:text-[#991B1B]"
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
            className="h-9 text-xs"
          />
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
            rows={5}
            value={message}
            onChange={handleMessageChange}
            placeholder="Write something..."
            error={!!errors.message || isOverLimit}
            disabled={formState === "submitting"}
            className="text-sm leading-relaxed"
          />

          {errors.message && (
            <p className="mt-1.5 text-xs text-[#EF4444] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.message}
            </p>
          )}
        </div>

        {/* Media Attachment & Preview */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            onChange={handleMediaSelect}
            className="hidden"
            id="media-file-input"
          />

          {!media ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={formState === "submitting"}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs text-[#737373] hover:text-[#171717] border-dashed"
              >
                <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-[#737373]" />
                Attach photo or video
              </Button>
              <span className="text-[11px] text-[#A3A3A3]">
                Max 5MB image · 20MB video
              </span>
            </div>
          ) : (
            <div className="border border-[#E5E7EB] rounded-lg p-2.5 bg-[#FAFAFA] relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#171717] flex items-center gap-1.5">
                  {media.type === "image" ? (
                    <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-[#2563EB]" />
                  )}
                  {media.file.name}
                  <span className="text-[11px] text-[#737373] font-normal">
                    ({formatBytes(media.file.size)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={removeMedia}
                  disabled={formState === "submitting"}
                  className="p-1 text-[#737373] hover:text-[#171717] rounded hover:bg-[#E5E7EB] transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {media.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.previewUrl}
                  alt="Attachment preview"
                  className="w-full max-h-56 object-cover rounded-md border border-[#E5E7EB]"
                />
              ) : (
                <video
                  src={media.previewUrl}
                  controls
                  className="w-full max-h-56 rounded-md border border-[#E5E7EB]"
                />
              )}
            </div>
          )}

          {errors.media && (
            <p className="mt-1.5 text-xs text-[#EF4444] flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.media}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={formState === "submitting"}
            disabled={formState === "submitting" || isOverLimit}
            className="w-full text-sm font-medium"
          >
            Send anonymously
          </Button>
        </div>
      </form>
    </div>
  );
}
