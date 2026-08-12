import React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchBoardPage } from "@/components/dispatch/DispatchBoardPage";

export default function DispatchPage() {
  return (
    <div className="flex flex-col h-full space-y-4 p-8">
      <PageHeader
        title="Dispatch & Scheduling"
        description="Manage driver assignments, vehicle availability, and job statuses in real-time."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Dispatch", href: "/dashboard/dispatch" },
        ]}
      />
      <DispatchBoardPage />
    </div>
  );
}
