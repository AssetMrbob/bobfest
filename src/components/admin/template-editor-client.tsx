"use client";

import * as React from "react";
import { CustomTemplate, LayerElementConfig } from "@/lib/types/template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Save,
  RotateCcw,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Upload,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Type,
  Image as ImageIcon,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Move,
  Layers3,
} from "lucide-react";
import {
  saveCustomTemplate,
  uploadTemplateAsset,
  renderUnifiedPreview,
} from "@/app/admin/template-actions";

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
    overlay_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 24,
    font_size_max: 44,
    font_weight: "500",
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      message_box: { x: 100, y: 280, width: 880, height: 750, visible: true, locked: false },
      recipient_box: { x: 100, y: 200, width: 880, height: 50, visible: true, locked: false },
      code_box: { x: 100, y: 1200, width: 880, height: 40, visible: true, locked: false },
      show_recipient: true,
      show_code: true,
      show_slide_number: true,
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
    overlay_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 22,
    font_size_max: 36,
    font_weight: "500",
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      media_box: { x: 100, y: 200, width: 880, height: 520, visible: true, locked: false, fitMode: "cover" },
      message_box: { x: 100, y: 760, width: 880, height: 420, visible: true, locked: false },
      recipient_box: { x: 100, y: 140, width: 880, height: 40, visible: true, locked: false },
      code_box: { x: 100, y: 1220, width: 880, height: 40, visible: true, locked: false },
      show_recipient: true,
      show_code: true,
      show_slide_number: true,
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
    overlay_storage_path: null,
    font_family: "Geist",
    font_file_path: null,
    font_size_min: 24,
    font_size_max: 38,
    font_weight: "500",
    text_color: "#171717",
    line_height: 1.35,
    letter_spacing: 0,
    vertical_align: "top",
    layout_config: {
      story_feed_box: { x: 108, y: 400, width: 864, height: 1080, visible: true, locked: false, fitMode: "contain" },
      message_box: { x: 100, y: 1520, width: 880, height: 240, visible: false, locked: false },
      code_box: { x: 100, y: 1800, width: 880, height: 40, visible: true, locked: false },
      show_recipient: false,
      show_code: true,
      show_slide_number: false,
    },
    is_active: true,
    version: 1,
  },
];

type LayerKey = "message_box" | "media_box" | "recipient_box" | "code_box" | "story_feed_box";

export function TemplateEditorClient({ initialTemplates }: TemplateEditorProps) {
  const [templates, setTemplates] = React.useState<CustomTemplate[]>(
    initialTemplates && initialTemplates.length > 0 ? initialTemplates : DEFAULT_TEMPLATES
  );
  const [selectedId, setSelectedId] = React.useState<string>(templates[0].id);

  // Active layer selection on canvas
  const [selectedLayer, setSelectedLayer] = React.useState<LayerKey | null>("message_box");

  // History stack for undo/redo
  const [history, setHistory] = React.useState<CustomTemplate[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);

  // Saved baseline for "Reset to saved"
  const [savedBaseline, setSavedBaseline] = React.useState<CustomTemplate[]>(templates);

  // Interactive vs Authoritative Final Preview
  const [activeTab, setActiveTab] = React.useState<"editor" | "final_preview">("editor");
  const [showGuides, setShowGuides] = React.useState<boolean>(true);

  // Preset sample messages
  const presets = {
    short: "Semangat buat kamu yang lagi berjuang skripsi! Pasti lulus tepat waktu kok! 🌟",
    medium:
      "Kadang kita ngerasa tertinggal jauh dari temen-temen seangkatan. Tapi inget, tiap orang punya garis start dan ritme lari masing-masing. Fokus sama langkahmu sendiri hari ini. You're doing great!",
    long:
      "Dear seseorang di perpus lantai 2 tadi sore yang pake hoodie biru navy. Makasih ya udah minjemin charger pas laptopku mati padahal tugas lagi deadline 10 menit lagi. Pas mau pamit kamu udah ga ada. Semoga ketemu lagi di kelas semester depan! Titip salam juga buat temenmu yang ramah banget.",
    chars500:
      "Halo teman-teman sekalian, mau ngingetin kalau masa-masa sulit ini cuma sementara. Jangan lupa makan teratur, tidur cukup, dan sesekali istirahat dari layar laptop. Kalau capek, ambil nafas dalam-dalam. Jalan keluar selalu ada buat mereka yang tekun dan bersabar. Kita semua berproses dengan ujiannya masing-masing. Semoga hari esok membawa kabar baik dan ketenangan buat hati kita semua. Tetap semangat, jangan patah arang, dan teruslah melangkah maju pelan-pelan sampai garis akhir tercapai nanti ya!",
  };

  const [sampleMessage, setSampleMessage] = React.useState<string>(presets.medium);
  const [sampleRecipient, setSampleRecipient] = React.useState<string>("Seseorang di Perpus L2");
  const [samplePublicCode, setSamplePublicCode] = React.useState<string>("MENFESS-88");
  const [sampleSlideOrder, setSampleSlideOrder] = React.useState<1 | 2>(1);
  const [sampleSlideCount, setSampleSlideCount] = React.useState<1 | 2>(1);
  const [samplePhotoUrl, setSamplePhotoUrl] = React.useState<string>("");

  // Production Authoritative Render Preview State
  const [isRendering, setIsRendering] = React.useState<boolean>(false);
  const [renderedFeedJpeg, setRenderedFeedJpeg] = React.useState<string | null>(null);
  const [renderedStoryJpeg, setRenderedStoryJpeg] = React.useState<string | null>(null);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [textFits, setTextFits] = React.useState<boolean>(true);
  const [overflowMessage, setOverflowMessage] = React.useState<string | null>(null);

  // Save / Upload UI Feedback
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);

  // Canvas Zoom control
  const [zoomLevel, setZoomLevel] = React.useState<number>(0.26);

  // Dragging and resizing state
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [isResizing, setIsResizing] = React.useState<string | null>(null); // handle: 'nw' | 'ne' | 'se' | 'sw'
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; box: LayerElementConfig }>({
    mouseX: 0,
    mouseY: 0,
    box: { x: 0, y: 0, width: 0, height: 0 },
  });

  const currentTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  // Push to history when making edits
  const pushHistory = (newTemplates: CustomTemplate[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(templates)));
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setTemplates(newTemplates);
  };

  const undo = () => {
    if (historyIndex >= 0) {
      const prev = history[historyIndex];
      setTemplates(prev);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setTemplates(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  };

  const resetToSaved = () => {
    pushHistory(JSON.parse(JSON.stringify(savedBaseline)));
  };

  // Update specific layer element bounding box
  const updateLayerBox = (
    layerKey: LayerKey,
    updates: Partial<LayerElementConfig>,
    trackHistory = true
  ) => {
    const next = templates.map((t) => {
      if (t.id !== selectedId) return t;
      const currentBox = (t.layout_config[layerKey] as LayerElementConfig) || {
        x: 100,
        y: 100,
        width: 400,
        height: 200,
      };
      return {
        ...t,
        layout_config: {
          ...t.layout_config,
          [layerKey]: {
            ...currentBox,
            ...updates,
          },
        },
      };
    });

    if (trackHistory) {
      pushHistory(next);
    } else {
      setTemplates(next);
    }
  };

  const toggleLayerVisibility = (layerKey: LayerKey) => {
    const currentBox = currentTemplate.layout_config[layerKey] as LayerElementConfig | undefined;
    const isVisible = currentBox?.visible !== false;
    updateLayerBox(layerKey, { visible: !isVisible });
  };

  const toggleLayerLock = (layerKey: LayerKey) => {
    const currentBox = currentTemplate.layout_config[layerKey] as LayerElementConfig | undefined;
    const isLocked = !!currentBox?.locked;
    updateLayerBox(layerKey, { locked: !isLocked });
  };

  const updateField = (field: keyof CustomTemplate, value: unknown) => {
    const next = templates.map((t) => (t.id === selectedId ? { ...t, [field]: value } : t));
    pushHistory(next);
  };

  // Keyboard arrow movement with Shift for large steps
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedLayer || activeTab !== "editor") return;
      const box = currentTemplate.layout_config[selectedLayer] as LayerElementConfig | undefined;
      if (!box || box.locked) return;

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;

      e.preventDefault();
      const canvasW = currentTemplate.dimensions.width;
      const canvasH = currentTemplate.dimensions.height;

      const newX = Math.max(0, Math.min(canvasW - box.width, box.x + dx));
      const newY = Math.max(0, Math.min(canvasH - box.height, box.y + dy));

      updateLayerBox(selectedLayer, { x: newX, y: newY }, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLayer, currentTemplate, activeTab]);

  // Execute Authoritative Server Render Preview
  const handleRenderPreview = React.useCallback(async () => {
    setIsRendering(true);
    setRenderError(null);
    setOverflowMessage(null);

    try {
      const res = await renderUnifiedPreview({
        template: currentTemplate,
        message: sampleMessage,
        recipient: sampleRecipient,
        publicCode: samplePublicCode,
        slideOrder: sampleSlideCount > 1 ? sampleSlideOrder : undefined,
        renderStory: currentTemplate.category === "story",
        sampleMediaUrl: samplePhotoUrl || undefined,
      });

      if (!res.success) {
        setRenderError(res.error || "Rendering preview failed.");
      } else {
        setRenderedFeedJpeg(res.feedJpegBase64 || null);
        setRenderedStoryJpeg(res.storyJpegBase64 || null);
        setTextFits(res.fits);
        if (!res.fits && res.overflowReason) {
          setOverflowMessage(res.overflowReason);
        }
      }
    } catch (err) {
      setRenderError((err as Error).message);
    } finally {
      setIsRendering(false);
    }
  }, [
    currentTemplate,
    sampleMessage,
    sampleRecipient,
    samplePublicCode,
    sampleSlideCount,
    sampleSlideOrder,
    samplePhotoUrl,
  ]);

  const prevActiveTabRef = React.useRef(activeTab);
  React.useEffect(() => {
    if (activeTab === "final_preview" && prevActiveTabRef.current !== "final_preview") {
      void handleRenderPreview();
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, handleRenderPreview]);

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await saveCustomTemplate(currentTemplate);
      if (res.success) {
        setSaveStatus("Template saved successfully & snapshot created.");
        setSavedBaseline(JSON.parse(JSON.stringify(templates)));
      } else {
        setSaveStatus(`Failed to save: ${res.error}`);
      }
    } catch (err) {
      setSaveStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Upload Asset handler (background, overlay, font)
  const handleUploadAsset = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: "background" | "overlay" | "font"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("assetType", assetType);

    try {
      const res = await uploadTemplateAsset(fd);
      if (res.success && res.storagePath) {
        if (assetType === "background") {
          updateField("background_storage_path", res.storagePath);
        } else if (assetType === "overlay") {
          updateField("overlay_storage_path", res.storagePath);
        } else if (assetType === "font") {
          updateField("font_file_path", res.storagePath);
          updateField("font_family", file.name.replace(/\.[^/.]+$/, ""));
        }
      } else {
        alert(res.error || "Upload failed");
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  // Download Authoritative Rendered JPEG
  const handleDownloadJpeg = () => {
    if (!renderedFeedJpeg) return;
    const a = document.createElement("a");
    a.href = renderedFeedJpeg;
    a.download = `${currentTemplate.name.toLowerCase().replace(/\s+/g, "_")}_authoritative.jpg`;
    a.click();
  };

  // Drag & Resize Mouse Handlers
  const handleMouseDownOnLayer = (e: React.MouseEvent, layerKey: LayerKey) => {
    e.stopPropagation();
    setSelectedLayer(layerKey);

    const box = currentTemplate.layout_config[layerKey] as LayerElementConfig | undefined;
    if (!box || box.locked) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...box },
    };
  };

  const handleMouseDownResize = (e: React.MouseEvent, handle: string, layerKey: LayerKey) => {
    e.stopPropagation();
    setSelectedLayer(layerKey);

    const box = currentTemplate.layout_config[layerKey] as LayerElementConfig | undefined;
    if (!box || box.locked) return;

    setIsResizing(handle);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      box: { ...box },
    };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!selectedLayer) return;
    const initial = dragStartRef.current;
    const canvasW = currentTemplate.dimensions.width;
    const canvasH = currentTemplate.dimensions.height;

    const dx = (e.clientX - initial.mouseX) / zoomLevel;
    const dy = (e.clientY - initial.mouseY) / zoomLevel;

    if (isDragging) {
      const newX = Math.round(
        Math.max(0, Math.min(canvasW - initial.box.width, initial.box.x + dx))
      );
      const newY = Math.round(
        Math.max(0, Math.min(canvasH - initial.box.height, initial.box.y + dy))
      );
      updateLayerBox(selectedLayer, { x: newX, y: newY }, false);
    } else if (isResizing) {
      let { x, y, width, height } = initial.box;

      if (isResizing.includes("e")) {
        width = Math.max(50, Math.min(canvasW - x, Math.round(initial.box.width + dx)));
      }
      if (isResizing.includes("s")) {
        height = Math.max(30, Math.min(canvasH - y, Math.round(initial.box.height + dy)));
      }
      if (isResizing.includes("w")) {
        const potentialW = Math.round(initial.box.width - dx);
        if (potentialW >= 50 && initial.box.x + dx >= 0) {
          x = Math.round(initial.box.x + dx);
          width = potentialW;
        }
      }
      if (isResizing.includes("n")) {
        const potentialH = Math.round(initial.box.height - dy);
        if (potentialH >= 30 && initial.box.y + dy >= 0) {
          y = Math.round(initial.box.y + dy);
          height = potentialH;
        }
      }

      updateLayerBox(selectedLayer, { x, y, width, height }, false);
    }
  };

  const handleMouseUpCanvas = () => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(null);
      pushHistory([...templates]);
    }
  };

  const layerList: Array<{ key: LayerKey; label: string; icon: React.ReactNode }> = [
    { key: "message_box", label: "Message Text Box", icon: <Type className="w-3.5 h-3.5" /> },
    { key: "media_box", label: "Media / Photo Area", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { key: "recipient_box", label: "Recipient Header", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "code_box", label: "Code & Slide Number", icon: <Layers className="w-3.5 h-3.5" /> },
    ...(currentTemplate.category === "story"
      ? [
          {
            key: "story_feed_box" as LayerKey,
            label: "Story Feed Slide Area",
            icon: <ImageIcon className="w-3.5 h-3.5" />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Top Studio Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-[#171717]">
              Template Studio WYSIWYG
            </h1>
            <span className="text-[10px] bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded font-mono font-semibold">
              Unified Server Engine
            </span>
          </div>
          <p className="text-xs text-[#737373]">
            Canva-like visual layout editor dengan authoritative server-side JPEG rendering pipeline.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo / Redo */}
          <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 border border-[#E5E7EB]">
            <button
              onClick={undo}
              disabled={historyIndex < 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-white text-[#4B5563] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-white text-[#4B5563] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={resetToSaved}
            className="text-xs h-8"
            title="Reset to saved configuration"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>

          {/* Tab Switcher */}
          <div className="flex bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === "editor"
                  ? "bg-white text-[#171717] shadow-sm"
                  : "text-[#6B7280] hover:text-[#171717]"
              }`}
            >
              Interactive Canvas
            </button>
            <button
              onClick={() => setActiveTab("final_preview")}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "final_preview"
                  ? "bg-white text-[#2563EB] shadow-sm font-semibold"
                  : "text-[#6B7280] hover:text-[#171717]"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Final Production Preview
            </button>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs h-8"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      {saveStatus && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
            saveStatus.includes("success")
              ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
              : "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
          }`}
        >
          {saveStatus.includes("success") ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {saveStatus}
        </div>
      )}

      {/* Main Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Templates, Layers & Typography (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Template Selection */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
                <Layers3 className="w-3.5 h-3.5 text-[#2563EB]" />
                Template Presets
              </span>
              <span className="text-[10px] text-[#737373] font-mono">
                {currentTemplate.dimensions.width}×{currentTemplate.dimensions.height}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedId(t.id);
                    setRenderedFeedJpeg(null);
                  }}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    t.id === selectedId
                      ? "border-[#2563EB] bg-[#EFF6FF]/60 text-[#2563EB] font-semibold ring-1 ring-[#2563EB]"
                      : "border-[#E5E7EB] bg-[#FAFAFA] text-[#4B5563] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <div className="text-[11px] truncate">{t.name}</div>
                  <div className="text-[9px] text-[#6B7280] capitalize mt-0.5">
                    {t.category.replace("_", " ")}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Canvas Layers Panel */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                Canvas Layers
              </span>
              <span className="text-[10px] text-[#737373]">Click to inspect</span>
            </div>

            <div className="space-y-1.5">
              {layerList.map((layer) => {
                const box = currentTemplate.layout_config[layer.key] as
                  | LayerElementConfig
                  | undefined;
                const isSelected = selectedLayer === layer.key;
                const isVisible = box?.visible !== false;
                const isLocked = !!box?.locked;

                return (
                  <div
                    key={layer.key}
                    onClick={() => setSelectedLayer(layer.key)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "border-[#2563EB] bg-[#EFF6FF]/50 text-[#171717] font-medium"
                        : "border-[#E5E7EB] bg-[#FAFAFA] text-[#6B7280] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {layer.icon}
                      <span className="text-xs">{layer.label}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(layer.key);
                        }}
                        className="p-1 hover:text-[#171717] text-[#9CA3AF]"
                        title={isVisible ? "Hide Layer" : "Show Layer"}
                      >
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-[#DC2626]" />
                        )}
                      </button>

                      {/* Lock Toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerLock(layer.key);
                        }}
                        className="p-1 hover:text-[#171717] text-[#9CA3AF]"
                        title={isLocked ? "Unlock Layer" : "Lock Layer"}
                      >
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Layer Numeric Coordinates */}
            {selectedLayer && currentTemplate.layout_config[selectedLayer] && (
              <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                <span className="text-[11px] font-semibold text-[#171717] block">
                  Numeric Position ({selectedLayer.replace("_", " ")})
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <label className="text-[10px] text-[#737373] block mb-0.5">X</label>
                    <Input
                      type="number"
                      value={currentTemplate.layout_config[selectedLayer]?.x || 0}
                      onChange={(e) =>
                        updateLayerBox(selectedLayer, { x: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-7 text-xs font-mono px-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#737373] block mb-0.5">Y</label>
                    <Input
                      type="number"
                      value={currentTemplate.layout_config[selectedLayer]?.y || 0}
                      onChange={(e) =>
                        updateLayerBox(selectedLayer, { y: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-7 text-xs font-mono px-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#737373] block mb-0.5">W</label>
                    <Input
                      type="number"
                      value={currentTemplate.layout_config[selectedLayer]?.width || 0}
                      onChange={(e) =>
                        updateLayerBox(selectedLayer, { width: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-7 text-xs font-mono px-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#737373] block mb-0.5">H</label>
                    <Input
                      type="number"
                      value={currentTemplate.layout_config[selectedLayer]?.height || 0}
                      onChange={(e) =>
                        updateLayerBox(selectedLayer, { height: parseInt(e.target.value, 10) || 0 })
                      }
                      className="h-7 text-xs font-mono px-1.5"
                    />
                  </div>
                </div>

                {/* Fit Mode for Media */}
                {(selectedLayer === "media_box" || selectedLayer === "story_feed_box") && (
                  <div className="pt-1">
                    <label className="text-[10px] text-[#737373] block mb-0.5">Fit Mode</label>
                    <select
                      value={currentTemplate.layout_config[selectedLayer]?.fitMode || "cover"}
                      onChange={(e) =>
                        updateLayerBox(selectedLayer, {
                          fitMode: e.target.value as "cover" | "contain",
                        })
                      }
                      className="w-full h-7 px-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded text-xs"
                    >
                      <option value="cover">Cover (Fill & Crop)</option>
                      <option value="contain">Contain (Preserve Aspect Ratio)</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Typography Controls */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 space-y-3 shadow-sm text-xs">
            <span className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-[#2563EB]" />
              Typography Rules (Left Aligned)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#737373] block mb-1">Font Family</label>
                <div className="font-mono text-xs p-1.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded truncate">
                  {currentTemplate.font_family}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#737373] block mb-1">Upload TTF/OTF</label>
                <label className="flex items-center justify-center gap-1.5 h-8 px-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer hover:bg-[#E5E7EB] text-[11px]">
                  <Upload className="w-3 h-3 text-[#2563EB]" />
                  <span>{isUploading ? "Uploading..." : "Custom Font"}</span>
                  <input
                    type="file"
                    accept=".ttf,.otf"
                    className="hidden"
                    onChange={(e) => handleUploadAsset(e, "font")}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Min Size (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.font_size_min}
                  onChange={(e) =>
                    updateField("font_size_min", parseInt(e.target.value, 10) || 20)
                  }
                  className="h-7 text-xs font-mono px-1.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Max Size (px)</label>
                <Input
                  type="number"
                  value={currentTemplate.font_size_max}
                  onChange={(e) =>
                    updateField("font_size_max", parseInt(e.target.value, 10) || 40)
                  }
                  className="h-7 text-xs font-mono px-1.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Line Height</label>
                <Input
                  type="number"
                  step="0.05"
                  value={currentTemplate.line_height}
                  onChange={(e) =>
                    updateField("line_height", parseFloat(e.target.value) || 1.35)
                  }
                  className="h-7 text-xs font-mono px-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={currentTemplate.text_color}
                    onChange={(e) => updateField("text_color", e.target.value)}
                    className="w-6 h-6 rounded border border-[#E5E7EB] cursor-pointer p-0"
                  />
                  <span className="font-mono text-[10px] truncate">
                    {currentTemplate.text_color}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Letter Spacing</label>
                <Input
                  type="number"
                  step="0.5"
                  value={currentTemplate.letter_spacing}
                  onChange={(e) =>
                    updateField("letter_spacing", parseFloat(e.target.value) || 0)
                  }
                  className="h-7 text-xs font-mono px-1.5"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#737373] block mb-0.5">Vertical Align</label>
                <select
                  value={currentTemplate.vertical_align}
                  onChange={(e) =>
                    updateField("vertical_align", e.target.value as "top" | "middle" | "bottom")
                  }
                  className="w-full h-7 px-1.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded text-xs"
                >
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Background & Overlay Assets */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 space-y-2.5 shadow-sm text-xs">
            <span className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
              Background & Transparent Overlay
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#737373] block mb-1">Background Image</label>
                <label className="flex items-center justify-center gap-1.5 h-8 px-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer hover:bg-[#E5E7EB] text-[11px]">
                  <Upload className="w-3 h-3 text-[#2563EB]" />
                  <span>Upload BG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => handleUploadAsset(e, "background")}
                  />
                </label>
                {currentTemplate.background_storage_path && (
                  <span className="text-[9px] text-[#059669] font-mono block mt-1 truncate">
                    Loaded: {currentTemplate.background_storage_path.split("/").pop()}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] text-[#737373] block mb-1">Transparent Overlay</label>
                <label className="flex items-center justify-center gap-1.5 h-8 px-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded cursor-pointer hover:bg-[#E5E7EB] text-[11px]">
                  <Upload className="w-3 h-3 text-[#2563EB]" />
                  <span>Upload PNG</span>
                  <input
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={(e) => handleUploadAsset(e, "overlay")}
                  />
                </label>
                {currentTemplate.overlay_storage_path && (
                  <span className="text-[9px] text-[#059669] font-mono block mt-1 truncate">
                    Loaded: {currentTemplate.overlay_storage_path.split("/").pop()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Canvas / Authoritative Preview (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Canvas Toolbar */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-[#2563EB]" />
                {activeTab === "editor" ? "Interactive Canvas" : "Production JPEG Preview"}
              </span>

              {activeTab === "editor" && (
                <label className="flex items-center gap-1.5 text-xs text-[#6B7280] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGuides}
                    onChange={(e) => setShowGuides(e.target.checked)}
                    className="rounded text-[#2563EB]"
                  />
                  <span>Show Guides & Bounds</span>
                </label>
              )}
            </div>

            {/* Zoom Controls & Preview Actions */}
            <div className="flex items-center gap-2">
              {activeTab === "editor" && (
                <div className="flex items-center bg-[#F3F4F6] rounded-lg p-0.5 border border-[#E5E7EB]">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.15, z - 0.04))}
                    className="p-1 rounded hover:bg-white text-[#4B5563]"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-mono px-1.5 text-[#4B5563]">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(0.5, z + 0.04))}
                    className="p-1 rounded hover:bg-white text-[#4B5563]"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(0.26)}
                    className="p-1 rounded hover:bg-white text-[#4B5563]"
                    title="Fit to Canvas"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {activeTab === "final_preview" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRenderPreview}
                    disabled={isRendering}
                    className="text-xs h-7"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-[#2563EB]" />
                    {isRendering ? "Rendering..." : "Re-render JPEG"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadJpeg}
                    disabled={!renderedFeedJpeg}
                    className="text-xs h-7"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download JPEG
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Validation Banner */}
          {overflowMessage && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold block">Typography Auto-fit Validation Alert:</span>
                <span>{overflowMessage}</span>
              </div>
            </div>
          )}

          {/* Main Visual Display Area */}
          <div
            ref={canvasRef}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            className="bg-[#1F2937]/5 border border-[#E5E7EB] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[560px] overflow-auto select-none relative"
          >
            {activeTab === "editor" ? (
              /* Interactive Canvas with Canva-like Controls */
              <div
                style={{
                  width: currentTemplate.dimensions.width * zoomLevel,
                  height: currentTemplate.dimensions.height * zoomLevel,
                }}
                className="relative bg-white shadow-2xl border border-[#D1D5DB] rounded-sm overflow-hidden select-none transition-shadow"
              >
                {/* 1. Background Layer */}
                <div className="absolute inset-0 bg-[#FFFFFF]">
                  {currentTemplate.background_storage_path && (
                    <div className="absolute inset-0 bg-cover bg-center opacity-90" />
                  )}
                </div>

                {/* 2. Media Area (photo_feed or Story) */}
                {currentTemplate.layout_config.media_box &&
                  currentTemplate.layout_config.media_box.visible !== false && (
                    <div
                      onMouseDown={(e) => handleMouseDownOnLayer(e, "media_box")}
                      style={{
                        left: currentTemplate.layout_config.media_box.x * zoomLevel,
                        top: currentTemplate.layout_config.media_box.y * zoomLevel,
                        width: currentTemplate.layout_config.media_box.width * zoomLevel,
                        height: currentTemplate.layout_config.media_box.height * zoomLevel,
                      }}
                      className={`absolute cursor-move border-2 ${
                        selectedLayer === "media_box" && showGuides
                          ? "border-[#10B981] ring-2 ring-[#10B981]/20 bg-[#ECFDF5]/30 z-20"
                          : showGuides
                          ? "border-dashed border-[#10B981]/60 bg-[#ECFDF5]/10 z-10"
                          : "border-transparent"
                      } flex items-center justify-center text-center p-2`}
                    >
                      <span className="text-[10px] text-[#059669] font-mono font-medium">
                        Photo Area ({currentTemplate.layout_config.media_box.width}×
                        {currentTemplate.layout_config.media_box.height}px)
                      </span>

                      {/* Resize Handles */}
                      {selectedLayer === "media_box" && showGuides && (
                        <>
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "nw", "media_box")}
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#10B981] rounded-full cursor-nwse-resize"
                          />
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "ne", "media_box")}
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#10B981] rounded-full cursor-nesw-resize"
                          />
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "se", "media_box")}
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#10B981] rounded-full cursor-nwse-resize"
                          />
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "sw", "media_box")}
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#10B981] rounded-full cursor-nesw-resize"
                          />
                        </>
                      )}
                    </div>
                  )}

                {/* 2b. Story Feed Slide Embedded Box */}
                {currentTemplate.category === "story" &&
                  currentTemplate.layout_config.story_feed_box &&
                  currentTemplate.layout_config.story_feed_box.visible !== false && (
                    <div
                      onMouseDown={(e) => handleMouseDownOnLayer(e, "story_feed_box")}
                      style={{
                        left: currentTemplate.layout_config.story_feed_box.x * zoomLevel,
                        top: currentTemplate.layout_config.story_feed_box.y * zoomLevel,
                        width: currentTemplate.layout_config.story_feed_box.width * zoomLevel,
                        height: currentTemplate.layout_config.story_feed_box.height * zoomLevel,
                      }}
                      className={`absolute cursor-move border-2 ${
                        selectedLayer === "story_feed_box" && showGuides
                          ? "border-[#8B5CF6] ring-2 ring-[#8B5CF6]/20 bg-[#F5F3FF]/30 z-20"
                          : showGuides
                          ? "border-dashed border-[#8B5CF6]/60 bg-[#F5F3FF]/10 z-10"
                          : "border-transparent"
                      } flex items-center justify-center text-center p-2`}
                    >
                      <span className="text-[10px] text-[#7C3AED] font-mono font-medium">
                        Embedded Feed Slide Area (
                        {currentTemplate.layout_config.story_feed_box.width}×
                        {currentTemplate.layout_config.story_feed_box.height}px)
                      </span>

                      {selectedLayer === "story_feed_box" && showGuides && (
                        <>
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "nw", "story_feed_box")}
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#8B5CF6] rounded-full cursor-nwse-resize"
                          />
                          <div
                            onMouseDown={(e) => handleMouseDownResize(e, "se", "story_feed_box")}
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#8B5CF6] rounded-full cursor-nwse-resize"
                          />
                        </>
                      )}
                    </div>
                  )}

                {/* 3. Recipient Header */}
                {currentTemplate.layout_config.recipient_box &&
                  currentTemplate.layout_config.recipient_box.visible !== false && (
                    <div
                      onMouseDown={(e) => handleMouseDownOnLayer(e, "recipient_box")}
                      style={{
                        left: currentTemplate.layout_config.recipient_box.x * zoomLevel,
                        top: currentTemplate.layout_config.recipient_box.y * zoomLevel,
                        width: currentTemplate.layout_config.recipient_box.width * zoomLevel,
                        height: currentTemplate.layout_config.recipient_box.height * zoomLevel,
                      }}
                      className={`absolute cursor-move border ${
                        selectedLayer === "recipient_box" && showGuides
                          ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-[#EFF6FF]/40 z-20"
                          : showGuides
                          ? "border-dashed border-[#2563EB]/40 bg-[#EFF6FF]/10 z-10"
                          : "border-transparent"
                      } px-2 flex items-center`}
                    >
                      <span
                        style={{
                          color: currentTemplate.text_color,
                          fontFamily: currentTemplate.font_family,
                          fontSize: Math.max(9, 24 * zoomLevel),
                        }}
                        className="font-bold truncate"
                      >
                        To: {sampleRecipient || "Recipient"}
                      </span>
                    </div>
                  )}

                {/* 4. Message Bounding Box */}
                <div
                  onMouseDown={(e) => handleMouseDownOnLayer(e, "message_box")}
                  style={{
                    left: currentTemplate.layout_config.message_box.x * zoomLevel,
                    top: currentTemplate.layout_config.message_box.y * zoomLevel,
                    width: currentTemplate.layout_config.message_box.width * zoomLevel,
                    height: currentTemplate.layout_config.message_box.height * zoomLevel,
                  }}
                  className={`absolute cursor-move border-2 ${
                    selectedLayer === "message_box" && showGuides
                      ? "border-[#2563EB] ring-2 ring-[#2563EB]/30 bg-[#2563EB]/5 z-20"
                      : showGuides
                      ? "border-dashed border-[#2563EB]/40 bg-[#2563EB]/5 z-10"
                      : "border-transparent"
                  } p-2 overflow-hidden flex flex-col justify-${
                    currentTemplate.vertical_align === "middle"
                      ? "center"
                      : currentTemplate.vertical_align === "bottom"
                      ? "end"
                      : "start"
                  }`}
                >
                  {showGuides && (
                    <div className="text-[8px] font-mono text-[#2563EB] font-bold mb-1 truncate">
                      MESSAGE BOX ({currentTemplate.layout_config.message_box.width}×
                      {currentTemplate.layout_config.message_box.height}px)
                    </div>
                  )}

                  <p
                    style={{
                      color: currentTemplate.text_color,
                      fontFamily: currentTemplate.font_family,
                      fontSize: Math.max(8, currentTemplate.font_size_max * zoomLevel * 0.9),
                      lineHeight: currentTemplate.line_height,
                      letterSpacing: `${currentTemplate.letter_spacing * zoomLevel}px`,
                    }}
                    className="leading-snug break-words text-left"
                  >
                    {sampleMessage}
                  </p>

                  {/* Resize Handles */}
                  {selectedLayer === "message_box" && showGuides && (
                    <>
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, "nw", "message_box")}
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#2563EB] rounded-full cursor-nwse-resize"
                      />
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, "ne", "message_box")}
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#2563EB] rounded-full cursor-nesw-resize"
                      />
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, "se", "message_box")}
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#2563EB] rounded-full cursor-nwse-resize"
                      />
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, "sw", "message_box")}
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#2563EB] rounded-full cursor-nesw-resize"
                      />
                    </>
                  )}
                </div>

                {/* 5. Reference Code Box */}
                {currentTemplate.layout_config.code_box &&
                  currentTemplate.layout_config.code_box.visible !== false && (
                    <div
                      onMouseDown={(e) => handleMouseDownOnLayer(e, "code_box")}
                      style={{
                        left: currentTemplate.layout_config.code_box.x * zoomLevel,
                        top: currentTemplate.layout_config.code_box.y * zoomLevel,
                        width: currentTemplate.layout_config.code_box.width * zoomLevel,
                        height: currentTemplate.layout_config.code_box.height * zoomLevel,
                      }}
                      className={`absolute cursor-move border ${
                        selectedLayer === "code_box" && showGuides
                          ? "border-[#6B7280] ring-2 ring-[#6B7280]/20 bg-[#F3F4F6]/60 z-20"
                          : showGuides
                          ? "border-dashed border-[#6B7280]/40 bg-[#F3F4F6]/20 z-10"
                          : "border-transparent"
                      } px-2 flex items-center`}
                    >
                      <span
                        style={{
                          color: currentTemplate.text_color,
                          fontSize: Math.max(7, 18 * zoomLevel),
                        }}
                        className="font-mono opacity-60 truncate"
                      >
                        REF: {samplePublicCode}{" "}
                        {sampleSlideCount > 1 ? `· SLIDE ${sampleSlideOrder}/2` : ""}
                      </span>
                    </div>
                  )}
              </div>
            ) : (
              /* Authoritative Final Production Render Preview */
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                {isRendering ? (
                  <div className="flex flex-col items-center gap-3 p-12 text-[#2563EB]">
                    <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">
                      Server-side Sharp glyph rendering in progress...
                    </span>
                  </div>
                ) : renderError ? (
                  <div className="p-6 bg-white border border-[#FECACA] rounded-xl text-center space-y-2 max-w-md">
                    <AlertCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
                    <div className="text-xs font-bold text-[#DC2626]">Render Error</div>
                    <div className="text-xs text-[#737373]">{renderError}</div>
                  </div>
                ) : renderedFeedJpeg ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <span className="text-[11px] font-semibold text-[#171717] bg-white px-2.5 py-0.5 rounded shadow-sm border border-[#E5E7EB]">
                      Authoritative Feed JPEG (1080×1350)
                    </span>
                    <img
                      src={renderedFeedJpeg}
                      alt="Authoritative Production Render"
                      style={{
                        width: 1080 * 0.28,
                        height: 1350 * 0.28,
                      }}
                      className="shadow-2xl rounded border border-[#E5E7EB] bg-white"
                    />
                  </div>
                ) : (
                  <div className="text-center text-xs text-[#737373]">
                    Click &ldquo;Re-render JPEG&rdquo; to generate authoritative server preview.
                  </div>
                )}

                {/* Optional Companion Story Render */}
                {renderedStoryJpeg && !isRendering && (
                  <div className="space-y-2 flex flex-col items-center">
                    <span className="text-[11px] font-semibold text-[#7C3AED] bg-white px-2.5 py-0.5 rounded shadow-sm border border-[#E5E7EB]">
                      Companion Story JPEG (1080×1920)
                    </span>
                    <img
                      src={renderedStoryJpeg}
                      alt="Companion Story Production Render"
                      style={{
                        width: 1080 * 0.28,
                        height: 1920 * 0.28,
                      }}
                      className="shadow-2xl rounded border border-[#E5E7EB] bg-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test & Preset Configuration Bar */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3 shadow-sm text-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                Preview & Testing Presets
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#6B7280]">Message Length:</span>
                <button
                  onClick={() => setSampleMessage(presets.short)}
                  className="px-2 py-0.5 bg-[#F3F4F6] rounded hover:bg-[#E5E7EB] text-[10px]"
                >
                  Short
                </button>
                <button
                  onClick={() => setSampleMessage(presets.medium)}
                  className="px-2 py-0.5 bg-[#F3F4F6] rounded hover:bg-[#E5E7EB] text-[10px]"
                >
                  Medium
                </button>
                <button
                  onClick={() => setSampleMessage(presets.long)}
                  className="px-2 py-0.5 bg-[#F3F4F6] rounded hover:bg-[#E5E7EB] text-[10px]"
                >
                  Long
                </button>
                <button
                  onClick={() => setSampleMessage(presets.chars500)}
                  className="px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] font-semibold rounded hover:bg-[#DBEAFE] text-[10px]"
                >
                  500 Chars
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-[11px] text-[#737373] block mb-1">
                  Editable Sample Message ({sampleMessage.length}/500 chars)
                </label>
                <textarea
                  rows={2}
                  value={sampleMessage}
                  onChange={(e) => setSampleMessage(e.target.value)}
                  className="w-full p-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#737373] block mb-1">Sample Recipient</label>
                <Input
                  value={sampleRecipient}
                  onChange={(e) => setSampleRecipient(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#737373] block mb-1">
                  Slide Preview (1 or 2 slides)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSampleSlideCount(1);
                      setSampleSlideOrder(1);
                    }}
                    className={`flex-1 h-8 rounded border text-xs font-medium ${
                      sampleSlideCount === 1
                        ? "bg-[#2563EB] text-white border-[#2563EB]"
                        : "bg-[#FAFAFA] text-[#6B7280] border-[#E5E7EB]"
                    }`}
                  >
                    Single Slide
                  </button>
                  <button
                    onClick={() => setSampleSlideCount(2)}
                    className={`flex-1 h-8 rounded border text-xs font-medium ${
                      sampleSlideCount === 2
                        ? "bg-[#2563EB] text-white border-[#2563EB]"
                        : "bg-[#FAFAFA] text-[#6B7280] border-[#E5E7EB]"
                    }`}
                  >
                    2 Slides
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
