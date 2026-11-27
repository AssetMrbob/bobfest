import { getAdminSubmissions } from "@/app/admin/actions";
import { InboxClient } from "./inbox-client";

export default async function AdminInboxPage() {
  const data = await getAdminSubmissions({ status: "all", limit: 100 });

  return (
    <InboxClient
      initialSubmissions={data.submissions}
      isConfigured={data.isConfigured}
    />
  );
}
