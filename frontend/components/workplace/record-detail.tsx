"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useGetAffectedAssignmentsQuery,
  useGetWorkplaceListQuery,
  useGetWorkplaceLookupsQuery,
  useGetWorkplaceRecordQuery,
  useWorkplaceMutationMutation,
  type WorkplaceRecord,
  type WorkplaceResource,
} from "@/services/api/workplace.api";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useEmployeeAccess } from "./access";
import { Attachments } from "./attachments";
import { WorkflowForm, dateInput, errorMessage, options, type Field } from "./forms";
import { RecordForm } from "./record-form";

export const recordTitle = (resource: WorkplaceResource, row: WorkplaceRecord) =>
  resource === "notices"
    ? row.revisions?.[0]?.title || "Notice"
    : resource === "incidents"
      ? row.title
      : row.description;

export const recordReference = (resource: WorkplaceResource, id: number, row?: WorkplaceRecord) => {
  if (resource === "incidents") {
    if (row?.reference) return row.reference;
    const d = row?.occurredAt ? new Date(row.occurredAt) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hash = String(id).padStart(6, "0").toUpperCase();
    return `IR-${yyyy}${mm}${dd}-${hash}`;
  }
  return `${resource === "notices" ? "NTC" : resource.endsWith("items") ? "FND" : "LPR"}-${String(id).padStart(6, "0")}`;
};

export function StatusBadge({ value }: { value: string }) {
  if (!value) return null;
  const upper = value.toUpperCase();
  let color = "bg-slate-100 text-slate-700 border-slate-200";
  if (["CRITICAL", "URGENT", "UNSAFE VEHICLE REPORTED"].includes(upper)) {
    color = "bg-red-50 text-red-700 border-red-200";
  } else if (["WARNING", "IN_STORAGE", "HIGH"].includes(upper)) {
    color = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (["CLOSED", "RETURNED", "RESOLVED", "PUBLISHED", "GOOD_NEWS"].includes(upper)) {
    color = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (
    ["SUBMITTED", "UNDER_REVIEW", "INFORMATION", "MEDIUM", "STANDARD", "LOW"].includes(upper)
  ) {
    color = "bg-sky-50 text-sky-700 border-sky-200";
  } else if (["IN_PROGRESS", "OWNER_CONTACTED"].includes(upper)) {
    color = "bg-purple-50 text-purple-700 border-purple-200";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

type ActionForm = { title: string; action: string; fields: Field[]; initial?: Record<string, any> };
const reasonField: Field = {
  name: "reason",
  label: "Reason / summary",
  type: "textarea",
  required: true,
};

export function RecordDetail({
  resource,
  id,
  onClose,
}: {
  resource: WorkplaceResource;
  id: number;
  onClose?: () => void;
}) {
  const access = useEmployeeAccess();
  const { data: row, isLoading, error, refetch } = useGetWorkplaceRecordQuery({ resource, id });
  const { data: lookups } = useGetWorkplaceLookupsQuery("");
  const [mutate, mutation] = useWorkplaceMutationMutation();
  const [actionForm, setActionForm] = useState<ActionForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [actionError, setActionError] = useState("");
  const markedRead = useRef("");

  const isNotice = resource === "notices";
  const isIncident = resource === "incidents";
  const isItem = resource.endsWith("items");
  const revision = row?.revisions?.[0];
  const receipt = revision?.recipients?.find((r: any) => r.userId === access.employee.id);
  const activeNotice = row?.status === "PUBLISHED";

  useEffect(() => {
    const key = `${id}:${revision?.revision}`;
    if (isNotice && activeNotice && revision && !receipt?.readAt && markedRead.current !== key) {
      markedRead.current = key;
      mutate({ resource, id, action: "read", body: { version: row!.version } })
        .unwrap()
        .catch((e) => {
          setActionError(errorMessage(e));
        });
    }
  }, [id, revision, isNotice, activeNotice, receipt, mutate, resource, row]);

  if (isLoading)
    return (
      <div className="rounded-2xl bg-white p-6" role="status">
        Loading record…
      </div>
    );
  if (error || !row)
    return (
      <div role="alert" className="space-y-3 rounded-2xl border bg-white p-6">
        <p>{errorMessage(error)}</p>
        <Button onClick={() => refetch()}>Retry</Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    );

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          timeZone: access.timeZone,
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const final = ["CLOSED", "RETURNED", "DISPOSED", "ARCHIVED"].includes(row.status);
  const employees =
    lookups?.employees.map((e) => ({
      value: e.id,
      label: `${e.firstName || ""} ${e.lastName || ""} · ${e.role}`,
    })) || [];
  if (row.ownerId && !employees.some((e) => e.value === row.ownerId))
    employees.push({ value: row.ownerId, label: `Current owner #${row.ownerId}` });

  const act = async (action: string, body: any = {}) => {
    setActionError("");
    try {
      await mutate({ resource, id, action, body: { version: row.version, ...body } }).unwrap();
      refetch();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };
  const showAction = (
    title: string,
    action: string,
    fields: Field[],
    initial?: Record<string, any>,
  ) => setActionForm({ title, action, fields, initial });

  return (
    <article className="min-w-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {actionError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {actionError}{" "}
          <button className="underline" onClick={() => refetch()}>
            Refresh record
          </button>
        </p>
      )}

      {/* ────────────────── INCIDENT DETAIL VIEW (Screenshot Style) ────────────────── */}
      {isIncident ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                INCIDENT RECORD
              </span>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {row.reference || recordReference("incidents", id, row)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{formatDate(row.occurredAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={row.severity} />
              <StatusBadge value={row.status} />
              {row.unsafeVehicle && <StatusBadge value="UNSAFE VEHICLE REPORTED" />}
              {onClose && (
                <button
                  onClick={onClose}
                  className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Close panel
                </button>
              )}
            </div>
          </div>

          {/* Incident Quick Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {!final && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  showAction("Add investigation update", "update", [
                    { name: "body", label: "Update / note", type: "textarea", required: true },
                    ...(access.office
                      ? [
                          {
                            name: "officeOnly",
                            label: "Office-only note",
                            type: "checkbox" as const,
                          },
                        ]
                      : []),
                  ])
                }
              >
                Add update
              </Button>
            )}
            {access.office && !final && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showAction("Change incident status", "transition", [
                      {
                        name: "status",
                        label: "Next status",
                        type: "select",
                        options: options([
                          "SUBMITTED",
                          "UNDER_REVIEW",
                          "IN_PROGRESS",
                          "RESOLVED",
                          "CLOSED",
                        ]),
                        required: true,
                      },
                      reasonField,
                      {
                        name: "duplicateOfId",
                        label: "Duplicate incident ID (optional)",
                        type: "number",
                      },
                    ])
                  }
                >
                  Change status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showAction(
                      "Assign responsible employee",
                      "assign",
                      [
                        { name: "ownerId", label: "Owner", type: "select", options: employees },
                        { name: "dueAt", label: "Due date", type: "datetime-local" as const },
                        {
                          name: "severity",
                          label: "Severity",
                          type: "select" as const,
                          options: options(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                          required: true,
                        },
                      ],
                      {
                        ownerId: row.ownerId || "",
                        severity: row.severity,
                        dueAt: row.dueAt ? dateInput(row.dueAt, access.timeZone) : "",
                      },
                    )
                  }
                >
                  Assign / triage
                </Button>
              </>
            )}
          </div>

          {/* Card 1: Driver and incident */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Driver and incident</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">REPORTED BY</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {row.reporter
                    ? `${row.reporter.firstName} ${row.reporter.lastName}`.toUpperCase()
                    : "UNKNOWN"}
                </dd>
                <dd className="text-xs text-slate-400">Employee #{row.reporterId || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">VEHICLE</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {row.vehicle?.licensePlate || (row.vehicleId ? `#${row.vehicleId}` : "—")}
                </dd>
                {row.vehicle?.licensePlate && (
                  <dd className="text-xs text-slate-400">{row.vehicle.licensePlate} · Fleet</dd>
                )}
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">CATEGORY</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {row.category?.replaceAll("_", " ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">LOCATION</dt>
                <dd className="mt-1 font-medium text-slate-900">{row.location || "—"}</dd>
              </div>
            </div>
          </div>

          {/* Card 2: Safety assessment */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Safety assessment</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-600">Injury</span>
                <span
                  className={`text-xs font-bold ${row.injury ? "text-red-600" : "text-slate-800"}`}
                >
                  {row.injury ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-600">Emergency services</span>
                <span
                  className={`text-xs font-bold ${row.emergencyServices ? "text-red-600" : "text-slate-800"}`}
                >
                  {row.emergencyServices ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-600">Police</span>
                <span
                  className={`text-xs font-bold ${row.policeInvolved ? "text-red-600" : "text-slate-800"}`}
                >
                  {row.policeInvolved ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-600">Safe to continue</span>
                <span
                  className={`text-xs font-bold ${row.safeToContinue ? "text-emerald-600" : "text-red-600"}`}
                >
                  {row.safeToContinue ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Report statement */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Report statement</h3>
            <div>
              <dt className="text-xs font-bold uppercase text-slate-400">WHAT HAPPENED</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.description}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-slate-400">IMMEDIATE ACTIONS</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {row.immediateAction || "None reported."}
              </dd>
            </div>
            <div>
              <dt className="mb-2 text-xs font-bold uppercase text-slate-400">
                PHOTOS & ATTACHMENTS
              </dt>
              <Attachments
                parent={{ incidentId: id }}
                editable={!final && (access.office || row.reporterId === access.employee.id)}
              />
            </div>
          </div>

          {/* Card 4: Investigation and actions (Screenshots 1 & 2) */}
          <IncidentInvestigationCard
            row={row}
            access={access}
            employees={employees}
            saving={mutation.isLoading}
            onSave={(fields) => act("save-progress", fields)}
            onCloseReport={(outcomeSummary) => act("close", { outcomeSummary })}
          />

          {access.office && row.vehicleId && <FleetImpact id={id} version={row.version} />}
        </div>
      ) : isItem ? (
        /* ────────────────── FOUND PROPERTY DETAIL VIEW ────────────────── */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                FOUND PROPERTY
              </span>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {recordReference(resource, id)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">Found {formatDate(row.occurredAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={row.status} />
              {onClose && (
                <button
                  onClick={onClose}
                  className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Close panel
                </button>
              )}
            </div>
          </div>

          {/* Card 1: Found Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Found item details</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">VEHICLE</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {row.vehicle?.licensePlate || (row.vehicleId ? `Vehicle #${row.vehicleId}` : "—")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">FOUND LOCATION</dt>
                <dd className="mt-1 font-semibold text-slate-900">{row.location}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-400">REPORTED BY</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  {row.reporter
                    ? `${row.reporter.firstName} ${row.reporter.lastName}`
                    : `Employee #${row.reporterId}`}
                </dd>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <dt className="text-xs font-bold uppercase text-slate-400">MESSAGE / DETAILS</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.description}</dd>
            </div>
          </div>

          {/* Status Progression */}
          {access.office && !final && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Status progression</h3>
              <div className="flex flex-wrap gap-2">
                {row.status === "SUBMITTED" && (
                  <Button
                    className="bg-sky-600 text-white hover:bg-sky-700"
                    onClick={() => act("status", { status: "IN_STORAGE" })}
                  >
                    Move to In Storage
                  </Button>
                )}
                {row.status === "IN_STORAGE" && (
                  <Button
                    className="bg-purple-600 text-white hover:bg-purple-700"
                    onClick={() => act("status", { status: "OWNER_CONTACTED" })}
                  >
                    Mark Owner Contacted
                  </Button>
                )}
                {row.status === "OWNER_CONTACTED" && (
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => act("status", { status: "RETURNED" })}
                  >
                    Mark Returned
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => act("close")}
                >
                  Close Record
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit Details
                </Button>
              </div>
            </div>
          )}

          {/* Photos & Attachments */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Photos & Attachments</h3>
            <Attachments parent={{ itemId: id }} editable={!final} />
          </div>
        </div>
      ) : (
        /* ────────────────── NOTICE BOARD DETAIL VIEW ────────────────── */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                NOTICE BOARD
              </span>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                {revision?.title || "Notice"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Published {formatDate(row.publishAt || row.createdAt)} · By{" "}
                {row.author ? `${row.author.firstName} ${row.author.lastName}` : "Office"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={revision?.priority} />
              <StatusBadge value={row.status} />
              {row.pinned && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  Pinned
                </span>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Close panel
                </button>
              )}
            </div>
          </div>

          {/* Office Actions */}
          <div className="flex flex-wrap gap-2">
            {access.office && !final && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit notice
              </Button>
            )}
            {access.office && ["DRAFT", "SCHEDULED"].includes(row.status) && (
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => act("publish")}
              >
                {row.publishAt && new Date(row.publishAt) > new Date()
                  ? "Schedule notice"
                  : "Publish notice"}
              </Button>
            )}
            {access.office && !final && (
              <Button variant="outline" onClick={() => act("archive")}>
                Archive
              </Button>
            )}
          </div>

          {/* Notice Content */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
              {revision?.body}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-3">
              <div>
                <span className="font-semibold text-slate-400">CATEGORY:</span> {revision?.category}
              </div>
              <div>
                <span className="font-semibold text-slate-400">AUDIENCE:</span>{" "}
                {revision?.audience?.length ? revision.audience.join(", ") : "All employees"}
              </div>
              <div>
                <span className="font-semibold text-slate-400">REVISION:</span> #
                {row.currentRevision}
              </div>
            </div>
          </div>

          {/* Attachments / Images */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Photos & Attachments</h3>
            <Attachments
              parent={{ noticeId: id }}
              editable={access.office && row.status !== "ARCHIVED"}
            />
          </div>

          {/* Revision history for office */}
          {access.office && row.revisions?.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Revision history</h3>
              {row.revisions.map((rev: any) => (
                <details
                  key={rev.id}
                  open={rev.revision === row.currentRevision}
                  className="rounded-xl border p-3"
                >
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Revision {rev.revision} · {rev.title}
                  </summary>
                  {rev.revision !== row.currentRevision && (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{rev.body}</p>
                  )}
                </details>
              ))}
            </section>
          )}
        </div>
      )}

      {editing && (
        <RecordForm
          resource={resource}
          record={row}
          onClose={() => setEditing(false)}
          onSaved={() => refetch()}
        />
      )}
      {matching && <MatchPicker resource={resource} row={row} onClose={() => setMatching(false)} />}
      {actionForm && (
        <WorkflowForm
          title={actionForm.title}
          fields={actionForm.fields}
          initial={actionForm.initial}
          onClose={() => setActionForm(null)}
          onSubmit={async (body) => {
            if (!body.duplicateOfId) delete body.duplicateOfId;
            await mutate({
              resource,
              id,
              action: actionForm.action,
              body: { version: row.version, ...body },
            }).unwrap();
            refetch();
          }}
        />
      )}
    </article>
  );
}

// ────────────────── INCIDENT INVESTIGATION CARD (Screenshot 2) ──────────────────
function IncidentInvestigationCard({
  row,
  access,
  employees,
  saving,
  onSave,
  onCloseReport,
}: {
  row: WorkplaceRecord;
  access: ReturnType<typeof useEmployeeAccess>;
  employees: { value: number; label: string }[];
  saving: boolean;
  onSave: (fields: any) => Promise<void>;
  onCloseReport: (summary: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(row.status || "SUBMITTED");
  const [severity, setSeverity] = useState(row.severity || "LOW");
  const [ownerId, setOwnerId] = useState(row.ownerId ? String(row.ownerId) : "");
  const [investigationSummary, setInvestigationSummary] = useState(row.investigationSummary || "");
  const [correctiveActions, setCorrectiveActions] = useState(row.correctiveActions || "");
  const [internalNotes, setInternalNotes] = useState(row.internalNotes || "");
  const [outcomeSummary, setOutcomeSummary] = useState(row.outcomeSummary || row.resolution || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [loadedRow, setLoadedRow] = useState(row);
  if (loadedRow !== row) {
    setLoadedRow(row);
    setStatus(row.status || "SUBMITTED");
    setSeverity(row.severity || "LOW");
    setOwnerId(row.ownerId ? String(row.ownerId) : "");
    setInvestigationSummary(row.investigationSummary || "");
    setCorrectiveActions(row.correctiveActions || "");
    setInternalNotes(row.internalNotes || "");
    setOutcomeSummary(row.outcomeSummary || row.resolution || "");
  }

  const handleSave = async () => {
    await onSave({
      status,
      severity,
      ownerId: ownerId ? Number(ownerId) : null,
      investigationSummary,
      correctiveActions,
      internalNotes,
      outcomeSummary,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleClose = async () => {
    await onCloseReport(outcomeSummary);
  };

  const isFinal = row.status === "CLOSED";

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Investigation and actions</h3>

      {/* Row 1: Status & Severity */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-600">Status *</label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!access.office}
          >
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Severity *</label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            disabled={!access.office}
          >
            <option value="LOW">Standard / Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Row 2: Assigned Staff Member */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Assigned staff member</label>
        <select
          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          disabled={!access.office}
        >
          <option value="">Unassigned</option>
          {employees.map((emp) => (
            <option key={emp.value} value={emp.value}>
              {emp.label}
            </option>
          ))}
        </select>
      </div>

      {/* Row 3: Investigation Summary */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Investigation summary</label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
          placeholder="Summary of investigation findings…"
          value={investigationSummary}
          onChange={(e) => setInvestigationSummary(e.target.value)}
          disabled={!access.office}
        />
      </div>

      {/* Row 4: Corrective Actions */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Corrective actions</label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
          placeholder="Actions taken or required to prevent recurrence…"
          value={correctiveActions}
          onChange={(e) => setCorrectiveActions(e.target.value)}
          disabled={!access.office}
        />
      </div>

      {/* Row 5: Internal Notes */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Internal notes</label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
          placeholder="Confidential office/management notes…"
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          disabled={!access.office}
        />
      </div>

      {/* Row 6: Outcome / Closure Summary */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Outcome / closure summary</label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-red-500 focus:outline-none disabled:bg-slate-50"
          placeholder="Final outcome, closure rationale, or resolution notes…"
          value={outcomeSummary}
          onChange={(e) => setOutcomeSummary(e.target.value)}
          disabled={!access.office}
        />
      </div>

      {/* Footer buttons */}
      {access.office && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-400">
            {row.owner
              ? `Assigned to: ${row.owner.firstName} ${row.owner.lastName}`
              : "Not assigned"}
            {savedSuccess && (
              <span className="ml-3 font-semibold text-emerald-600">✓ Progress saved</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              type="button"
              className="gap-2 rounded-xl border-slate-300 px-4 text-slate-700 hover:bg-slate-50"
              onClick={handleSave}
              disabled={saving}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              Save progress
            </Button>
            {!isFinal && (
              <Button
                type="button"
                className="gap-2 rounded-xl bg-rose-500 px-4 text-white hover:bg-rose-600"
                onClick={handleClose}
                disabled={saving}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Close report
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FleetImpact({ id, version }: { id: number; version: number }) {
  const { data = [], isError, refetch } = useGetAffectedAssignmentsQuery(id);
  const [open, setOpen] = useState(false);
  const [mutate] = useWorkplaceMutationMutation();

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-900">Fleet impact review</h3>
      <p className="text-sm text-amber-800">
        Maintenance blocks new allocations. Existing jobs need an explicit dispatch decision.
      </p>
      {isError ? (
        <Button onClick={() => refetch()}>Retry affected assignments</Button>
      ) : (
        <>
          <p className="text-sm font-medium text-amber-900">{data.length} affected assignment(s)</p>
          {data.map((a) => (
            <Link
              className="block text-sm text-amber-800 underline"
              href={`/dashboard/dispatch?date=${String(a.scheduledStart).slice(0, 10)}`}
              key={a.id}
            >
              Job #{a.jobId} · {a.status}
            </Link>
          ))}
        </>
      )}
      <Button variant="outline" disabled={isError} onClick={() => setOpen(true)}>
        Record fleet decision
      </Button>
      {open && (
        <WorkflowForm
          title="Confirm fleet impact"
          fields={[
            {
              name: "decision",
              label: "Decision",
              type: "select",
              options: [
                { value: "MAINTENANCE", label: "Place vehicle in maintenance" },
                { value: "NO_CHANGE", label: "No fleet status change" },
              ],
              required: true,
            },
            reasonField,
          ]}
          onClose={() => setOpen(false)}
          onSubmit={async (body) => {
            await mutate({
              resource: "incidents",
              id,
              action: "fleet-impact",
              body: { ...body, version },
            }).unwrap();
          }}
        >
          <p className="text-sm">
            {data.length} existing assignment(s) remain for review. This action does not cancel
            them.
          </p>
        </WorkflowForm>
      )}
    </section>
  );
}

function MatchPicker({
  resource,
  row,
  onClose,
}: {
  resource: WorkplaceResource;
  row: WorkplaceRecord;
  onClose: () => void;
}) {
  const isItem = resource.endsWith("items");
  const opposite: WorkplaceResource = isItem ? "lost-property/reports" : "lost-property/items";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isError } = useGetWorkplaceListQuery({
    resource: opposite,
    params: { search, page, ...(isItem ? { status: "OPEN" } : {}) },
  });
  const [mutate] = useWorkplaceMutationMutation();
  const candidates =
    data?.items.filter((r) => ["OPEN", "FOUND", "IN_STORAGE", "SUBMITTED"].includes(r.status)) ||
    [];

  return (
    <WorkflowForm
      title="Confirm property match"
      fields={[
        {
          name: "candidateId",
          label: isItem ? "Lost report" : "Found item",
          type: "select",
          options: candidates.map((r) => ({
            value: r.id,
            label: `${recordReference(opposite, r.id)} · ${r.description}`,
          })),
          required: true,
        },
      ]}
      onClose={onClose}
      onSubmit={async (body) => {
        const candidate = candidates.find((r) => r.id === Number(body.candidateId));
        if (!candidate) throw new Error("Choose a current candidate");
        const report = isItem ? candidate : row;
        const item = isItem ? row : candidate;
        await mutate({
          resource: "lost-property/matches",
          body: {
            reportId: report.id,
            itemId: item.id,
            reportVersion: report.version,
            itemVersion: item.version,
          },
        }).unwrap();
      }}
    >
      <p className="text-sm">Compare identifying details before confirming.</p>
      <Input
        aria-label="Search match candidates"
        placeholder="Search descriptions…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {isError && (
        <p role="alert" className="text-red-700">
          Unable to load candidates.
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!data || page * 25 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </WorkflowForm>
  );
}
