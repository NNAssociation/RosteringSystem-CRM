"use client";
import { useGetWorkplaceListQuery, type WorkplaceResource } from "@/services/api/workplace.api";
import Link from "next/link";
import { featureEnabled, useEmployeeAccess } from "./access";

export function WorkplaceAttention() {
  const access = useEmployeeAccess();
  return (
    <div className="space-y-2">
      {featureEnabled(access, "notices") && (
        <CompactAttention
          title="Notices to acknowledge"
          resource="notices"
          params={{ view: "acknowledgement" }}
          href="/dashboard/notices?view=acknowledgement"
        />
      )}
      {featureEnabled(access, "incidents") && (
        <CompactAttention
          title="Incidents needing review"
          resource="incidents"
          params={{ attention: "true" }}
          href="/dashboard/incidents?attention=true"
        />
      )}
      {featureEnabled(access, "lostProperty") && (
        <CompactAttention
          title="Property awaiting collection"
          resource="lost-property/items"
          params={{ status: "RESERVED" }}
          href="/dashboard/lost-property?tab=items&status=RESERVED"
        />
      )}
    </div>
  );
}

function CompactAttention({
  title,
  resource,
  params,
  href,
}: {
  title: string;
  resource: WorkplaceResource;
  params: Record<string, string>;
  href: string;
}) {
  const { data } = useGetWorkplaceListQuery(
    { resource, params: { ...params, pageSize: 1 } },
    { refetchOnFocus: true, pollingInterval: 30000, skipPollingIfUnfocused: true },
  );

  if (!data?.total) return null;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-amber-200 bg-amber-50/60 p-3 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
          {data.total}
        </span>
      </div>
      <p className="mt-1 text-xs text-blue-700 font-medium">Review records →</p>
    </Link>
  );
}
