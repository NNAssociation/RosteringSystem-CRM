import React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchBoardPage } from "@/components/dispatch/DispatchBoardPage";

export default function DispatchPage() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Dispatch & Scheduling"
        description="Manage driver assignments, vehicle availability, and job statuses in real-time."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Dispatch" },
        ]}
        className="px-0 py-0 border-none"
      />
      <DispatchBoardPage />
    </div>
  );
}
