"use client";

import * as React from "react";
import { MOCK_PUBLISHED_POSTS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import { InstagramIcon } from "@/components/ui/icons";

export default function AdminPublishedPage() {
  const posts = MOCK_PUBLISHED_POSTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Published Feed & Stories
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Archive of published carousel batches with companion Story verifications.
          </p>
        </div>
        <div className="text-xs text-[#737373]">
          Total Batches Published: {posts.length}
        </div>
      </div>

      {/* Grid of Published Batches */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 hover:border-[#D1D5DB] transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <InstagramIcon className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-mono font-medium text-[#171717]">
                  Post ID: {post.instagramPostId}
                </span>
                <span className="text-xs text-[#737373]">·</span>
                <span className="text-xs text-[#737373]">
                  {formatDateTime(post.publishedAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {post.companionStoryPublished && (
                  <span className="inline-flex items-center gap-1 text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7] text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Story Verified
                  </span>
                )}
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                >
                  <span>Instagram</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Submissions Included in Batch */}
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">
                Included Messages ({post.submissions.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {post.submissions.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg"
                  >
                    {item.recipient && (
                      <span className="font-semibold text-[#171717] block mb-0.5">
                        To: {item.recipient}
                      </span>
                    )}
                    <p className="text-[#737373] line-clamp-1 italic">
                      &ldquo;{item.snippet}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
