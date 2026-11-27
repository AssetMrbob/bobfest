"use client";

import * as React from "react";
import { formatDateTime } from "@/lib/utils";
import { InstagramIcon } from "@/components/ui/icons";
import { ExternalLink } from "lucide-react";

interface PublicationItem {
  id: string;
  slide_order: number;
  submissions: {
    public_code: string;
    message: string;
  } | null;
}

interface PublishedBatch {
  id: string;
  scheduled_time: string;
  status: string;
  carousel_container_id?: string | null;
  story_container_id?: string | null;
  permalink?: string | null;
  published_at?: string | null;
  publication_items: PublicationItem[];
}

interface PublishedClientProps {
  initialData: {
    isConfigured: boolean;
    batches: PublishedBatch[];
  };
}

export function PublishedClient({ initialData }: PublishedClientProps) {
  const { batches } = initialData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Published Archive
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Historical log of published Instagram feed carousels and companion stories.
          </p>
        </div>
        <div className="text-xs text-[#737373]">
          Total Published: {batches.length} batches
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-8 sm:p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center mx-auto mb-3 text-[#737373]">
            <InstagramIcon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#171717]">
            No published posts yet
          </h3>
          <p className="text-xs text-[#737373] mt-1 max-w-sm mx-auto">
            Once scheduled batches publish via Instagram Graph API, records and live Instagram links will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#171717]">
                      {formatDateTime(batch.published_at || batch.scheduled_time)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                      Published
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#737373] mt-1">
                    <span>ID: {batch.id.slice(0, 8)}</span>
                    {batch.carousel_container_id && (
                      <span>Container ID: {batch.carousel_container_id}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {batch.permalink && (
                    <a
                      href={batch.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                    >
                      <span>View on Instagram</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Submissions in this batch */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider block">
                  Included Submissions ({batch.publication_items?.length || 0}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {batch.publication_items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg"
                    >
                      <span className="font-mono text-[10px] text-[#737373] block mb-0.5">
                        Slide {item.slide_order} · Ref: {item.submissions?.public_code || "Unknown"}
                      </span>
                      <p className="text-xs text-[#171717] line-clamp-2">
                        {item.submissions?.message || "No content"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
