"use client";
import Link from "next/link";
import { featureEnabled, useEmployeeAccess } from "./access";
export function WorkplaceContextLinks({
  vehicleId,
  bookingId,
  jobId,
  assignmentId,
}: {
  vehicleId?: number | string | null;
  bookingId?: number | string | null;
  jobId?: number | string | null;
  assignmentId?: number | string | null;
}) {
  const access = useEmployeeAccess();
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ vehicleId, bookingId, jobId, assignmentId })
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    ),
  ).toString();
  if (!featureEnabled(access, "incidents") && !featureEnabled(access, "lostProperty")) return null;
  return (
    <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium">
      {featureEnabled(access, "incidents") && (
        <>
          <Link
            className="text-red-700 hover:underline"
            href={`/dashboard/incidents?new=1&${params}`}
          >
            Report incident
          </Link>
          <Link className="text-slate-600 hover:underline" href={`/dashboard/incidents?${params}`}>
            Related incidents
          </Link>
        </>
      )}
      {featureEnabled(access, "lostProperty") && (
        <>
          <Link
            className="text-red-700 hover:underline"
            href={`/dashboard/lost-property?tab=items&new=1&${params}`}
          >
            Record found item
          </Link>
          <Link
            className="text-slate-600 hover:underline"
            href={`/dashboard/lost-property?tab=items&${params}`}
          >
            Related found items
          </Link>
          {bookingId && (
            <Link
              className="text-slate-600 hover:underline"
              href={`/dashboard/lost-property?tab=reports&${params}`}
            >
              Related lost reports
            </Link>
          )}
        </>
      )}
    </div>
  );
}
