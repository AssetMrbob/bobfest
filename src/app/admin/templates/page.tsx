"use client";

import * as React from "react";
import { MOCK_TEMPLATES } from "@/lib/mock-data";
import { CarouselTemplate } from "@/lib/types/admin";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = React.useState<CarouselTemplate>(
    MOCK_TEMPLATES[0]
  );
  const [previewText, setPreviewText] = React.useState(
    "Don't beat yourself up over this exam week. You prepared the best you could, and a grade will never define your worth."
  );
  const [previewRecipient, setPreviewRecipient] = React.useState("To whoever needs to hear this");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Carousel & Story Templates
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Swiss editorial styling and canvas dimensions for automated Sharp image generation.
          </p>
        </div>
        <div className="text-xs text-[#737373]">
          Feed Canvas: 1080×1350 (4:5) · Story Canvas: 1080×1920 (9:16)
        </div>
      </div>

      {/* Main Grid: Template Selector & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-[#171717] tracking-tight uppercase">
            Available Styles
          </h2>
          {MOCK_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => setSelectedTemplate(tpl)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedTemplate.id === tpl.id
                  ? "border-[#2563EB] bg-[#EFF6FF]/20"
                  : "border-[#E5E7EB] bg-[#FFFFFF] hover:bg-[#FAFAFA]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#171717]">
                  {tpl.name}
                </span>
                {tpl.isDefault && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-[#737373] leading-relaxed">
                {tpl.description}
              </p>
              <div className="mt-2 text-[11px] font-mono text-[#737373]">
                {tpl.canvasWidth}×{tpl.canvasHeight} · {tpl.fontFamily}
              </div>
            </div>
          ))}

          {/* Interactive Slide Content Customizer */}
          <div className="p-4 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-[#171717] uppercase tracking-wider">
              Test Slide Content
            </h3>
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1">
                Recipient (To)
              </label>
              <Input
                value={previewRecipient}
                onChange={(e) => setPreviewRecipient(e.target.value)}
                className="h-11 sm:h-8 text-base sm:text-xs"
                placeholder="Recipient label"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1">
                Message Body
              </label>
              <Textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={3}
                className="text-base sm:text-xs leading-relaxed"
                placeholder="Slide message text..."
              />
            </div>
          </div>

          {/* Typography & Color Customization Notice */}
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs text-[#737373]">
            <p className="font-medium text-[#171717] mb-1">Swiss Editorial Rules</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>High-contrast pure monochrome text</li>
              <li>Generous padding for readability</li>
              <li>Minimal watermark branding: menfess.</li>
            </ul>
          </div>
        </div>

        {/* Live Canvas Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#171717] tracking-tight uppercase">
              Live Feed Slide Preview (4:5 Ratio)
            </h2>
            <span className="text-xs text-[#737373] font-mono">1080 × 1350 px</span>
          </div>

          {/* 4:5 Aspect Ratio Container */}
          <div className="max-w-md mx-auto w-full aspect-[4/5] bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-5 sm:p-8 flex flex-col justify-between shadow-none relative">
            {/* Top Brand Watermark */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-[#171717]">
                menfess<span className="text-[#2563EB]">.</span>
              </span>
              <span className="text-xs font-mono text-[#737373]">#142</span>
            </div>

            {/* Middle Message Text */}
            <div className="my-auto space-y-4">
              {previewRecipient && (
                <div className="text-xs uppercase tracking-wider font-semibold text-[#2563EB]">
                  To: {previewRecipient}
                </div>
              )}
              <p className="text-lg sm:text-xl font-medium tracking-tight text-[#171717] leading-relaxed">
                &ldquo;{previewText}&rdquo;
              </p>
            </div>

            {/* Bottom Footer */}
            <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#737373]">
              <span>Anonymous Submission</span>
              <span>@menfess.id</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
