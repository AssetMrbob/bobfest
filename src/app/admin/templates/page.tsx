import { TemplateEditorClient } from "@/components/admin/template-editor-client";
import { Suspense } from "react";

export default function AdminTemplatesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#737373]">Loading template studio...</div>}>
      <TemplateEditorClient />
    </Suspense>
  );
}
