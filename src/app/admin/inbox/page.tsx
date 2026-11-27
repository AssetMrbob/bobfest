import { getAdminSubmissions } from "@/app/admin/actions";
import { InboxClient } from "./inbox-client";
import { Suspense } from "react";

async function InboxContent() {
  const data = await getAdminSubmissions({ status: "all", limit: 100 });
  return (
    <InboxClient
      initialSubmissions={data.submissions}
      isConfigured={data.isConfigured}
    />
  );
}

export default function AdminInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#737373]">
          Loading inbox submissions...
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
