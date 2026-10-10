"use client";

import { FilterBar, FilterGroup } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useHeader } from "@/providers/header-provider";
import { useGetWorkplaceListQuery, type WorkplaceResource } from "@/services/api/workplace.api";
import { Search } from "@mui/icons-material";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useEmployeeAccess } from "./access";
import { errorMessage, zonedISO } from "./forms";
import { RecordDetail, StatusBadge, recordReference, recordTitle } from "./record-detail";
import {
  RecordForm,
  incidentCategories,
  noticeCategories,
  propertyCategories,
} from "./record-form";

const titles = {
  notices: "Notice Board",
  incidents: "Incidents",
  "lost-property/reports": "Lost Property",
  "lost-property/items": "Lost Property",
};

const descriptions = {
  notices: "Operational updates, bulletins, and staff announcements.",
  incidents: "Report safety incidents, coordinate supervisor actions, and track resolution.",
  "lost-property/reports": "Customer lost property inquiries and matched recovered items.",
  "lost-property/items": "Register recovered found items and track owner collections.",
};

const statuses = {
  notices: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"],
  incidents: ["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  "lost-property/reports": ["OPEN", "MATCHED", "RETURNED", "CLOSED"],
  "lost-property/items": ["SUBMITTED", "IN_STORAGE", "OWNER_CONTACTED", "RETURNED", "CLOSED"],
};

export function WorkplacePage({ module }: { module: "notices" | "incidents" | "lost-property" }) {
  const query = useSearchParams();
  const router = useRouter();
  const access = useEmployeeAccess();
  const [kind, setKind] = useState(query.get("tab") === "reports" ? "reports" : "items");
  const resource: WorkplaceResource =
    module === "lost-property" ? `lost-property/${kind as "items" | "reports"}` : module;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(query.get("status") || "ALL");
  const [category, setCategory] = useState("");
  const [view, setView] = useState(query.get("view") || "all");
  const [page, setPage] = useState(1);
  const [vehicle, setVehicle] = useState(query.get("vehicleId") || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(query.get("new") === "1");

  const { setHeaderConfig } = useHeader();
  useEffect(() => {
    setHeaderConfig({ title: titles[resource] });
  }, [resource, setHeaderConfig]);

  const params = {
    search,
    page,
    view,
    ...(query.get("attention") === "true" ? { attention: "true" } : {}),
    ...(status && status !== "ALL" ? { status } : {}),
    ...(category ? { category } : {}),
    ...(vehicle ? { vehicleId: vehicle } : {}),
    ...(query.get("bookingId") ? { bookingId: query.get("bookingId")! } : {}),
    ...(query.get("jobId") ? { jobId: query.get("jobId")! } : {}),
    ...(from ? { from: zonedISO(`${from}T00:00`, access.timeZone) } : {}),
    ...(to
      ? { to: new Date(Date.parse(zonedISO(`${to}T23:59`, access.timeZone)) + 59999).toISOString() }
      : {}),
  };

  const { data, isLoading, isFetching, error, refetch } = useGetWorkplaceListQuery(
    { resource, params },
    { refetchOnFocus: true },
  );

  const categories =
    module === "notices"
      ? noticeCategories
      : module === "incidents"
        ? incidentCategories
        : propertyCategories;

  const filter = (set: (s: string) => void, value: string) => {
    set(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setCategory("");
    setVehicle("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / 25));

  const availableStatuses = useMemo(() => {
    return ["ALL", ...statuses[resource]];
  }, [resource]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* CRM Standard PageHeader */}
      <PageHeader
        title={titles[resource]}
        description={descriptions[resource]}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: titles[resource] }]}
        className="px-0 py-0 border-none"
        actions={
          <div className="flex items-center gap-3">
            {module === "lost-property" && (
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  onClick={() => {
                    setKind("items");
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    kind === "items"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  Found Items
                </button>
                <button
                  onClick={() => {
                    setKind("reports");
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    kind === "reports"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  Lost Reports
                </button>
              </div>
            )}
            {(module !== "notices" || access.office) && (
              <Button
                className="h-10 px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                <span>
                  {module === "notices"
                    ? "Create Notice"
                    : module === "incidents"
                      ? "Report Incident"
                      : "Record Item"}
                </span>
              </Button>
            )}
          </div>
        }
      />

      {/* CRM Standard FilterBar matching customers/bookings */}
      <FilterBar className="bg-white shadow-sm border-slate-200 py-3 px-4 rounded-3xl">
        <FilterGroup position="left" className="gap-1">
          {availableStatuses.map((st) => (
            <button
              key={st}
              onClick={() => filter(setStatus, st)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold tracking-tight transition-all",
                status === st
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              {st === "ALL" ? "All Records" : st.replaceAll("_", " ")}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup position="right" className="gap-3">
          {module !== "lost-property" && (
            <select
              aria-label="Filter category"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={category}
              onChange={(e) => filter(setCategory, e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          )}

          <div className="relative group flex-1 min-w-[220px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
              style={{ fontSize: "20px" }}
            />
            <Input
              aria-label="Search records"
              placeholder="Search reference, details…"
              value={search}
              onChange={(e) => filter(setSearch, e.target.value)}
              className="pl-10 pr-4 h-10 w-full bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all text-xs font-medium"
            />
          </div>

          {(search || (status && status !== "ALL") || category || vehicle || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-blue-600 font-semibold h-10"
            >
              Clear
            </Button>
          )}
        </FilterGroup>
      </FilterBar>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center justify-between"
        >
          <span>{errorMessage(error)}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="min-w-0">
          {isLoading ? (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400"
            >
              Loading records…
            </div>
          ) : !data?.items.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-2">
              <h2 className="font-bold text-slate-700">No records to display</h2>
              <p className="text-xs text-slate-500">
                Create a record or adjust your filters above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="p-4">
                      Reference / {module === "notices" ? "Title" : "Details"}
                    </th>
                    <th className="p-4">Category</th>
                    {module !== "lost-property" && (
                      <th className="p-4">{module === "notices" ? "Priority" : "Severity"}</th>
                    )}
                    <th className="p-4">
                      {module === "notices" ? "Audience" : "Location / Vehicle"}
                    </th>
                    {module !== "notices" && (
                      <th className="p-4">
                        {module === "incidents" ? "Driver / Reporter" : "Custodian / Reporter"}
                      </th>
                    )}
                    <th className="p-4">{module === "notices" ? "Published" : "Date & Time"}</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((row) => {
                    const revision = row.revisions?.[0];
                    const href = `/dashboard/${resource}/${row.id}`;
                    const personName = (person: any) =>
                      person
                        ? [person.firstName, person.lastName].filter(Boolean).join(" ") ||
                          person.email ||
                          "—"
                        : "—";
                    const date =
                      module === "notices" ? row.publishedAt : row.occurredAt || row.createdAt;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => router.push(href)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="p-4">
                          <Link
                            className="font-bold text-blue-700 hover:underline"
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.reference || recordReference(resource, row.id)}
                          </Link>
                          <p className="mt-1 max-w-md truncate font-medium text-slate-800">
                            {recordTitle(resource, row)}
                          </p>
                          {row.pinned && <span className="text-blue-600">Pinned</span>}
                        </td>
                        <td className="p-4">
                          {(revision?.category || row.category || "—").replaceAll("_", " ")}
                        </td>
                        {module !== "lost-property" && (
                          <td className="p-4">
                            <StatusBadge
                              value={module === "notices" ? revision?.priority : row.severity}
                            />
                          </td>
                        )}
                        <td className="p-4">
                          {module === "notices" ? (
                            revision?.audience?.length ? (
                              revision.audience.join(", ")
                            ) : (
                              "All Employees"
                            )
                          ) : (
                            <>
                              {row.location || row.storageLocation || "—"}
                              <p className="font-medium">{row.vehicle?.licensePlate || "—"}</p>
                            </>
                          )}
                        </td>
                        {module !== "notices" && (
                          <td className="p-4">
                            {module === "incidents"
                              ? personName(row.assignment?.driver || row.reporter)
                              : personName(row.custodian || row.reporter)}
                            {row.assignment?.driver && row.reporter && (
                              <p className="text-slate-500">
                                Reported by {personName(row.reporter)}
                              </p>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap p-4 text-slate-500">
                          {date
                            ? new Date(date).toLocaleString(undefined, {
                                timeZone: access.timeZone,
                                dateStyle: "medium",
                                ...(module !== "notices" ? { timeStyle: "short" as const } : {}),
                              })
                            : "Not published"}
                        </td>
                        <td className="p-4">
                          <StatusBadge value={row.status} />
                        </td>
                        <td className="p-4">
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-blue-700 hover:underline"
                            aria-label={`View ${row.reference || recordReference(resource, row.id)}`}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Standard CRM Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={data?.total}
            itemsPerPage={25}
          />
        </div>
      </div>

      {creating && (
        <RecordForm
          resource={resource}
          defaults={Object.fromEntries(
            ["vehicleId", "bookingId", "jobId", "assignmentId"]
              .filter((key) => query.get(key))
              .map((key) => [key, Number(query.get(key))]),
          )}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            router.push(`/dashboard/${resource}/${id}`);
          }}
        />
      )}
    </div>
  );
}

export function WorkplaceDetailPage({ resource, id }: { resource: WorkplaceResource; id: number }) {
  const { setHeaderConfig } = useHeader();
  const router = useRouter();

  useEffect(() => {
    setHeaderConfig({ title: titles[resource] });
  }, [resource, setHeaderConfig]);

  if (!Number.isSafeInteger(id) || id < 1) return <p className="p-8">Invalid record reference.</p>;

  return (
    <div className="space-y-6 p-6 lg:p-8 w-full">
      <PageHeader
        title={titles[resource]}
        description={recordReference(resource, id)}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: titles[resource],
            href: resource.startsWith("lost-property")
              ? `/dashboard/lost-property?tab=${resource.split("/")[1]}`
              : `/dashboard/${resource}`,
          },
          { label: recordReference(resource, id) },
        ]}
      />
      <Button
        variant="outline"
        size="sm"
        className="rounded-lg text-xs"
        onClick={() =>
          router.push(
            resource.startsWith("lost-property")
              ? `/dashboard/lost-property?tab=${resource.split("/")[1]}`
              : `/dashboard/${resource}`,
          )
        }
      >
        ← Back to {titles[resource]}
      </Button>
      <RecordDetail resource={resource} id={id} />
    </div>
  );
}
