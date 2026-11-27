import { getPublishingQueue } from "@/app/admin/actions";
import { QueueClient } from "@/components/admin/queue-client";
import { Suspense } from "react";

async function QueueContent() {
  const data = await getPublishingQueue();
  return <QueueClient initialData={data} />;
}

export default function AdminQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#737373]">
          Loading publishing queue...
        </div>
      }
    >
      <QueueContent />
    </Suspense>
  );
}
