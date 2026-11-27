"use client";

import * as React from "react";
import { Image as ImageIcon, Video as VideoIcon, X, Loader2, AlertCircle } from "lucide-react";
import { optimizeImageClient, validateVideoClient } from "@/lib/media/client-optimizer";

export interface UploadedMediaData {
  reservationToken: string;
  storagePath: string;
  mimeType: string;
  mediaType: "image" | "video";
  sizeBytes: number;
}

interface MediaAttachmentProps {
  onMediaReady: (media: UploadedMediaData | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  disabled?: boolean;
}

export function MediaAttachment({
  onMediaReady,
  onUploadingChange,
  disabled,
}: MediaAttachmentProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [mediaType, setMediaType] = React.useState<"image" | "video" | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or file reset
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setUploadProgress(0);

    const isImage = selected.type.startsWith("image/");
    const isVideo = selected.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Please select a valid image (JPEG, PNG, WebP) or video (MP4, MOV).");
      return;
    }

    // Set local preview immediately
    const localUrl = URL.createObjectURL(selected);
    setPreviewUrl(localUrl);
    setFile(selected);
    setMediaType(isImage ? "image" : "video");
    setUploading(true);
    onUploadingChange(true);

    try {
      let uploadBlob: Blob = selected;
      let targetMime = selected.type;

      // 1. Client-Side Optimization
      if (isImage) {
        if (selected.size > 5 * 1024 * 1024) {
          throw new Error("Image exceeds 5MB size limit.");
        }
        setUploadProgress(20);
        const optimized = await optimizeImageClient(selected);
        uploadBlob = optimized.file;
        targetMime = optimized.mimeType;
      } else if (isVideo) {
        setUploadProgress(20);
        const validation = await validateVideoClient(selected);
        if (!validation.valid) {
          throw new Error(validation.error || "Video validation failed.");
        }
      }

      setUploadProgress(40);

      // 2. Request atomic reservation & signed upload URL from server
      const urlRes = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: targetMime }),
      });

      const urlData = await urlRes.json();
      if (!urlRes.ok || !urlData.success) {
        throw new Error(urlData.error || "Unable to reserve storage for media.");
      }

      setUploadProgress(60);

      // 3. Direct upload to Supabase Storage via signed upload URL
      const uploadHeaders: Record<string, string> = {
        "Content-Type": targetMime,
      };

      const directRes = await fetch(urlData.signedUrl, {
        method: "PUT",
        headers: uploadHeaders,
        body: uploadBlob,
      });

      if (!directRes.ok) {
        throw new Error("Failed to upload media file directly to storage.");
      }

      setUploadProgress(100);
      setUploading(false);
      onUploadingChange(false);

      // 4. Notify parent of completed upload payload
      onMediaReady({
        reservationToken: urlData.reservationToken,
        storagePath: urlData.path,
        mimeType: targetMime,
        mediaType: urlData.mediaType,
        sizeBytes: uploadBlob.size,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process and upload media.";
      console.error("Upload workflow error:", err);
      setError(message);
      setUploading(false);
      onUploadingChange(false);
      onMediaReady(null);
    }
  };

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setError(null);
    setUploading(false);
    onUploadingChange(false);
    onMediaReady(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />

      {/* When no file is selected: Minimal attachment selector */}
      {!file && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-[#F5F5F5] text-xs font-medium text-[#171717] transition-colors min-h-[44px]"
          >
            <ImageIcon className="w-4 h-4 text-[#2563EB]" />
            <span>Add photo or video</span>
          </button>
          <span className="text-[11px] text-[#A3A3A3]">Max 5MB img / 20MB vid</span>
        </div>
      )}

      {/* Preview container */}
      {previewUrl && (
        <div className="relative border border-[#E5E7EB] rounded-lg p-2.5 bg-[#FAFAFA] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-12 h-12 rounded bg-[#E5E7EB] overflow-hidden flex items-center justify-center shrink-0">
              {mediaType === "image" ? (
                <img
                  src={previewUrl}
                  alt="Attachment preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <VideoIcon className="w-5 h-5 text-[#737373]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#171717] truncate">
                {file?.name}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[#737373]">
                <span>{(file?.size ? (file.size / 1024).toFixed(0) : "0")} KB</span>
                {uploading && (
                  <span className="inline-flex items-center gap-1 text-[#2563EB]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading ({uploadProgress}%)
                  </span>
                )}
                {!uploading && !error && (
                  <span className="text-[#16A34A] font-medium">Ready</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="p-2 text-[#737373] hover:text-[#DC2626] rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-2.5 bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg text-xs text-[#991B1B] flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#DC2626]" />
          <div className="flex-1">
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
