import { getPublishedArchive } from "@/app/admin/actions";
import { PublishedClient } from "@/components/admin/published-client";
import { Suspense } from "react";

async function PublishedContent() {
  const data = await getPublishedArchive();
  return <PublishedClient initialData={data} />;
}

export default function AdminPublishedPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[#737373]">
          Loading published archive...
        </div>
      }
    >
      <PublishedContent />
    </Suspense>
  );
}
