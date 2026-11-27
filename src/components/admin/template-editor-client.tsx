"use client";

import * as React from "react";
import { CustomTemplate, BoundingBox } from "@/lib/types/template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Layout, Eye } from "lucide-react";

interface TemplateEditorProps {
  initialTemplates?: CustomTemplate[];
}

const DEFAULT_TEMPLATES: CustomTemplate[] = [
  {
    id: "default-text-feed",
    name: "Classic Swiss Text Feed",
    category: "text_feed",
    dimensions: { width: 1080, height: 1350 },
    background_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 24,
    font_size_max: 44,
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      message_box: { x: 100, y: 280, width: 880, height: 750 },
      media_box: { x: 100, y: 280, width: 880, height: 500 },
      recipient_box: { x: 100, y: 200, width: 880, height: 50 },
      code_box: { x: 100, y: 1200, width: 880, height: 40 },
    },
    is_active: true,
    version: 1,
  },
  {
    id: "default-photo-feed",
    name: "Split Photo & Text Feed",
    category: "photo_feed",
    dimensions: { width: 1080, height: 1350 },
    background_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 22,
    font_size_max: 36,
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      media_box: { x: 100, y: 200, width: 880, height: 520 },
      message_box: { x: 100, y: 760, width: 880, height: 420 },
      recipient_box: { x: 100, y: 140, width: 880, height: 40 },
      code_box: { x: 100, y: 1220, width: 880, height: 40 },
    },
    is_active: true,
    version: 1,
  },
  {
    id: "default-story",
    name: "Standard Companion Story",
    category: "story",
    dimensions: { width: 1080, height: 1920 },
    background_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 24,
    font_size_max: 38,
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      message_box: { x: 100, y: 1520, width: 880, height: 240 },
      media_box: { x: 108, y: 400, width: 864, height: 1080 },
      code_box: { x: 100, y: 1800, width: 880, height: 40 },
    },
    is_active: true,
    version: 1,
  },
];

export function TemplateEditorClient({ initialTemplates }: TemplateEditorProps) {
  const [templates, setTemplates] = React.useState<CustomTemplate[]>(
    initialTemplates && initialTemplates.length > 0 ? initialTemplates : DEFAULT_TEMPLATES
  );
  const [selectedId, setSelectedId] = React.useState<string>(templates[0].id);
  const [activeTab, setActiveTab] = React.useState<"editor" | "preview">("editor");

  const currentTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  const updateMessageBox = (key: keyof BoundingBox, value: number) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id !== selectedId) return t;
        return {
          ...t,
          layout_config: {
            ...t.layout_config,
            message_box: {
              ...t.layout_config.message_box,
              [key]: value,
            },
          },
        };
      })
    );
  };

  const updateField = (field: keyof CustomTemplate, value: unknown) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, [field]: value } : t))
    );
  };

  // Preview scale: 1080px -> 320px (~0.3 scale)
  const scale = 0.28;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#171717]">
            Instagram Template Studio
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Admin visual template positioning, typography rules, and custom bounding boxes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab(activeTab === "editor" ? "preview" : "editor")}
            className="text-xs"
          >
            {activeTab === "editor" ? <Eye className="w-3.5 h-3.5 mr-1.5" /> : <Layout className="w-3.5 h-3.5 mr-1.5" />}
            {activeTab === "editor" ? "Preview Mode" : "Coordinate Editor"}
          </Button>
          <Button size="sm" variant="primary" className="text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Active Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Select & Typography Settings */}
        <div className="space-y-5">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-semibold text-[#171717] uppercase tracking-wider">
              Templates
            </h2>
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    t.id === selectedId
                      ? "border-[#2563EB] bg-[#EFF6FF]/40 text-[#2563EB]"
                      : "border-[#E5E7EB] bg-[#FAFAFA] text-[#171717] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.name}</span>
                    {t.is_active && (
                      <span className="text-[10px] bg-[#ECFDF5] text-[#059669] px-2 py-0.5 rounded font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#737373] capitalize block mt-0.5">
                    {t.category.replace("_", " ")} · {t.dimensions.width}×{t.dimensions.height}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Typography Controls */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4 space-y-3 text-xs">
            <h2 className="text-xs font-semibold text-[#171717] uppercase tracking-wider">
              Typography Controls (Left Aligned)
            </h2>

            <div>
              <label className="block text-[#737373] mb-1">Font Family</label>
              <select
                value={currentTemplate.font_family}
                onChange={(e) => updateField("font_family", e.target.value)}
                className="w-full h-9 px-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs"
              >
                <option value="Geist">Geist (Default Modern Swiss)</option>
                <option value="Inter">Inter</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#737373] mb-1">Max Font Size (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.font_size_max}
                  onChange={(e) => updateField("font_size_max", parseInt(e.target.value, 10))}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-1">Min Font Size (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.font_size_min}
                  onChange={(e) => updateField("font_size_min", parseInt(e.target.value, 10))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#737373] mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTemplate.text_color}
                    onChange={(e) => updateField("text_color", e.target.value)}
                    className="w-8 h-8 rounded border border-[#E5E7EB] cursor-pointer"
                  />
                  <span className="font-mono text-xs">{currentTemplate.text_color}</span>
                </div>
              </div>
              <div>
                <label className="block text-[#737373] mb-1">Vertical Align</label>
                <select
                  value={currentTemplate.vertical_align}
                  onChange={(e) => updateField("vertical_align", e.target.value as "top" | "middle" | "bottom")}
                  className="w-full h-9 px-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Coordinate Sliders */}
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-4 space-y-3 text-xs">
            <h2 className="text-xs font-semibold text-[#171717] uppercase tracking-wider">
              Message Box Coordinates
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#737373] mb-0.5">X Offset (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.layout_config.message_box.x}
                  onChange={(e) => updateMessageBox("x", parseInt(e.target.value, 10))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-0.5">Y Offset (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.layout_config.message_box.y}
                  onChange={(e) => updateMessageBox("y", parseInt(e.target.value, 10))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-0.5">Width (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.layout_config.message_box.width}
                  onChange={(e) => updateMessageBox("width", parseInt(e.target.value, 10))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[#737373] mb-0.5">Height (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.layout_config.message_box.height}
                  onChange={(e) => updateMessageBox("height", parseInt(e.target.value, 10))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Visual Interactive Canvas Preview */}
        <div className="lg:col-span-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[500px]">
          <div className="text-xs font-mono text-[#737373] mb-3">
            Canvas: {currentTemplate.dimensions.width}×{currentTemplate.dimensions.height} px (Preview scaled to {Math.round(scale * 100)}%)
          </div>

          <div
            style={{
              width: currentTemplate.dimensions.width * scale,
              height: currentTemplate.dimensions.height * scale,
            }}
            className="relative bg-white shadow-lg border border-[#E5E7EB] rounded-lg overflow-hidden select-none"
          >
            {/* Recipient area */}
            {currentTemplate.layout_config.recipient_box && (
              <div
                style={{
                  left: currentTemplate.layout_config.recipient_box.x * scale,
                  top: currentTemplate.layout_config.recipient_box.y * scale,
                  width: currentTemplate.layout_config.recipient_box.width * scale,
                  height: currentTemplate.layout_config.recipient_box.height * scale,
                }}
                className="absolute border border-dashed border-[#2563EB]/40 bg-[#EFF6FF]/20 px-2 flex items-center text-[9px] font-semibold text-[#2563EB]"
              >
                To: Recipient Placeholder
              </div>
            )}

            {/* Media Area (for photo templates) */}
            {currentTemplate.layout_config.media_box && currentTemplate.category === "photo_feed" && (
              <div
                style={{
                  left: currentTemplate.layout_config.media_box.x * scale,
                  top: currentTemplate.layout_config.media_box.y * scale,
                  width: currentTemplate.layout_config.media_box.width * scale,
                  height: currentTemplate.layout_config.media_box.height * scale,
                }}
                className="absolute border-2 border-dashed border-[#10B981] bg-[#ECFDF5]/30 flex items-center justify-center text-[10px] text-[#059669] font-mono"
              >
                Photo Area ({currentTemplate.layout_config.media_box.width}×{currentTemplate.layout_config.media_box.height}px)
              </div>
            )}

            {/* Message Box */}
            <div
              style={{
                left: currentTemplate.layout_config.message_box.x * scale,
                top: currentTemplate.layout_config.message_box.y * scale,
                width: currentTemplate.layout_config.message_box.width * scale,
                height: currentTemplate.layout_config.message_box.height * scale,
              }}
              className="absolute border-2 border-[#2563EB] bg-[#2563EB]/5 p-2 overflow-hidden"
            >
              <span className="text-[8px] font-mono text-[#2563EB] font-bold block mb-1">
                MESSAGE BOUNDING BOX ({currentTemplate.layout_config.message_box.width}×{currentTemplate.layout_config.message_box.height}px)
              </span>
              <p
                style={{
                  fontSize: Math.max(8, currentTemplate.font_size_max * scale),
                  lineHeight: currentTemplate.line_height,
                  color: currentTemplate.text_color,
                }}
                className="font-medium text-left leading-tight"
              >
                &ldquo;Don&apos;t beat yourself up over this exam week. You prepared the best you could, and a grade will never define your worth.&rdquo;
              </p>
            </div>

            {/* Code Box */}
            {currentTemplate.layout_config.code_box && (
              <div
                style={{
                  left: currentTemplate.layout_config.code_box.x * scale,
                  top: currentTemplate.layout_config.code_box.y * scale,
                  width: currentTemplate.layout_config.code_box.width * scale,
                  height: currentTemplate.layout_config.code_box.height * scale,
                }}
                className="absolute border border-dashed border-[#737373]/30 px-2 flex items-center text-[8px] font-mono text-[#737373]"
              >
                REF: MENFESS1234 · SLIDE 1/2
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
