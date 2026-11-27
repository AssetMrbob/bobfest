import { getDashboardMetrics } from "@/app/admin/actions";
import { OverviewClient } from "@/components/admin/overview-client";
import { Suspense } from "react";

async function OverviewContent() {
  const metrics = await getDashboardMetrics("all");

  return <OverviewClient initialMetrics={metrics} />;
}

export default function AdminOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#737373]">
          Loading dashboard metrics...
        </div>
      }
    >
      <OverviewContent />
    </Suspense>
  );
}
