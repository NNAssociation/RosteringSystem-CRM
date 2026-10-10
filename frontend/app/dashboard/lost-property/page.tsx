import { WorkplacePage } from "@/components/workplace/workplace-page";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <WorkplacePage module="lost-property" />
    </Suspense>
  );
}
