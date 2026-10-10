"use client";

import { Input } from "@/components/ui/input";
import {
  useGetWorkplaceLookupsQuery,
  useUploadAttachmentMutation,
  useWorkplaceMutationMutation,
  type WorkplaceRecord,
  type WorkplaceResource,
} from "@/services/api/workplace.api";
import { useEffect, useState } from "react";
import { useEmployeeAccess } from "./access";
import { formatFileSize } from "./attachments";
import { WorkflowForm, dateInput, options, type Field } from "./forms";

export const noticeCategories = ["GENERAL", "SAFETY", "OPERATIONS", "MAINTENANCE", "HR"];
export const noticePriorities = ["INFORMATION", "WARNING", "CRITICAL", "GOOD_NEWS"];
export const incidentCategories = [
  "COLLISION",
  "INJURY",
  "BREAKDOWN",
  "VEHICLE_DAMAGE",
  "PASSENGER_ISSUE",
  "CUSTOMER_PASSENGER_INCIDENT",
  "NEAR_MISS",
  "OTHER",
];
export const propertyCategories = [
  "BAG",
  "PHONE",
  "WALLET",
  "CLOTHING",
  "KEYS",
  "DOCUMENTS",
  "ELECTRONICS",
  "OTHER",
];

function PendingFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The effect owns this browser resource and revokes it during cleanup.
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        title="Remove file"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function RecordForm({
  resource,
  record,
  defaults = {},
  onClose,
  onSaved,
}: {
  resource: WorkplaceResource;
  record?: WorkplaceRecord;
  defaults?: Record<string, any>;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const access = useEmployeeAccess();
  const [search, setSearch] = useState("");
  const { data: lookups, isError } = useGetWorkplaceLookupsQuery(search, {
    skip: resource === "notices",
  });
  const [mutate] = useWorkplaceMutationMutation();
  const [uploadAttachment] = useUploadAttachmentMutation();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const isNotice = resource === "notices";
  const isIncident = resource === "incidents";
  const isItem = resource.endsWith("items");

  const initial: Record<string, any> = record
    ? {
        ...record,
        ...(isNotice ? record.revisions?.[0] : {}),
        ...(record.privateDetails
          ? {
              claimantName: record.privateDetails.name,
              claimantContact: record.privateDetails.contact,
              handlingNotes: record.privateDetails.notes,
            }
          : {}),
      }
    : {
        ...defaults,
        category: isNotice ? "GENERAL" : isIncident ? "OTHER" : "OTHER",
        priority: "INFORMATION",
        severity: "LOW",
        safeToContinue: true,
        occurredAt: new Date().toISOString(),
        reporterId: access.employee.id,
        status: isItem ? "SUBMITTED" : undefined,
      };

  for (const key of ["occurredAt", "publishAt"])
    if (initial[key]) initial[key] = dateInput(initial[key], access.timeZone);

  const audienceGroups = [
    { value: "ALL_EMPLOYEES", label: "All Employees", roles: [] as string[] },
    { value: "DRIVERS", label: "Drivers", roles: ["DRIVER"] },
    { value: "MECHANICS_YARD", label: "Mechanics / Yard", roles: ["MECHANIC", "YARD"] },
    { value: "DISPATCHERS", label: "Dispatchers", roles: ["DISPATCHER"] },
    { value: "ADMIN_MANAGEMENT", label: "Management", roles: ["ADMIN", "MANAGER"] },
  ];
  if (isNotice) {
    const audience: string[] = initial.audience || [];
    initial.audienceGroup =
      audienceGroups.find(
        (g) => g.roles.length === audience.length && g.roles.every((r) => audience.includes(r)),
      )?.value || "CUSTOM";
    if (initial.audienceGroup === "CUSTOM")
      audienceGroups.push({
        value: "CUSTOM",
        label: `Existing audience: ${audience.join(", ")}`,
        roles: audience,
      });
  }
  let fields: Field[];
  if (isNotice) {
    fields = [
      { name: "title", label: "Title", required: true },
      { name: "body", label: "Message", type: "textarea", required: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: options(noticeCategories),
        required: true,
      },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: options(noticePriorities),
        required: true,
      },
      {
        name: "audienceGroup",
        label: "Audience",
        type: "select",
        required: true,
        options: audienceGroups,
      },
      { name: "pinned", label: "Pin this notice", type: "checkbox" },
      ...(!record || record.status !== "PUBLISHED"
        ? [
            {
              name: "publishAt",
              label: "Schedule publication (optional)",
              type: "datetime-local" as const,
            },
          ]
        : []),
    ];
  } else if (isItem) {
    fields = [
      {
        name: "vehicleId",
        label: "Vehicle",
        type: "select",
        options: lookups?.vehicles.map((v) => ({ value: v.id, label: v.licensePlate })),
        required: true,
      },
      { name: "location", label: "Found location", required: true },
      ...(access.office
        ? [
            {
              name: "reporterId",
              label: "Reported by",
              type: "select" as const,
              options: lookups?.employees.map((e) => ({
                value: e.id,
                label: `${e.firstName || ""} ${e.lastName || ""} · ${e.role}`,
              })),
            },
          ]
        : []),
      { name: "description", label: "Message / Description", type: "textarea", required: true },
      { name: "occurredAt", label: "Found date and time", type: "datetime-local" },
      ...(access.office
        ? [
            {
              name: "status",
              label: "Status",
              type: "select" as const,
              options: options([
                "SUBMITTED",
                "IN_STORAGE",
                "OWNER_CONTACTED",
                "RETURNED",
                "CLOSED",
              ]),
            },
          ]
        : []),
    ];
  } else {
    fields = [
      ...(isIncident ? [{ name: "title", label: "Title", required: true }] : []),
      {
        name: "description",
        label: isIncident ? "What happened" : "Description",
        type: "textarea",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: options(isIncident ? incidentCategories : propertyCategories),
        required: true,
      },
      {
        name: "occurredAt",
        label: isIncident ? "Incident date and time" : "Approximate loss date and time",
        type: "datetime-local",
        required: true,
      },
      { name: "location", label: "Location", required: true },
      {
        name: "vehicleId",
        label: "Vehicle (optional)",
        type: "select",
        options: lookups?.vehicles.map((v) => ({ value: v.id, label: v.licensePlate })),
      },
      {
        name: "jobId",
        label: "Job (optional)",
        type: "select",
        options: lookups?.jobs.map((j) => ({
          value: j.id,
          label: `Job #${j.id} · ${j.jobStartLocation || "Trip"}`,
        })),
      },
      ...(access.office
        ? [{ name: "bookingId", label: "Booking ID (optional)", type: "number" as const }]
        : []),
      ...(isIncident
        ? [
            {
              name: "severity",
              label: "Severity",
              type: "select" as const,
              options: options(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
              required: true,
            },
            {
              name: "immediateAction",
              label: "Immediate actions taken",
              type: "textarea" as const,
            },
            { name: "safeToContinue", label: "Safe to continue", type: "checkbox" as const },
            { name: "injury", label: "Injury occurred", type: "checkbox" as const },
            {
              name: "emergencyServices",
              label: "Emergency services called",
              type: "checkbox" as const,
            },
            { name: "policeInvolved", label: "Police involved", type: "checkbox" as const },
            {
              name: "unsafeVehicle",
              label: "Vehicle reported unsafe — requires office review",
              type: "checkbox" as const,
            },
          ]
        : [
            { name: "colour", label: "Colour" },
            { name: "brand", label: "Brand" },
            { name: "identifyingDetails", label: "Identifying details", type: "textarea" as const },
            ...(access.office
              ? [
                  {
                    name: "customerId",
                    label: "Customer (optional)",
                    type: "select" as const,
                    options: lookups?.customers.map((c) => ({
                      value: c.id,
                      label: c.name || `Customer #${c.id}`,
                    })),
                  },
                  { name: "claimantName", label: "Claimant name · office only" },
                  { name: "claimantContact", label: "Claimant contact · office only" },
                  {
                    name: "handlingNotes",
                    label: "Handling notes · office only",
                    type: "textarea" as const,
                  },
                ]
              : []),
          ]),
    ];
  }

  // Preserve contextual selections even when they are outside the first lookup page.
  for (const field of fields) {
    if (
      field.type === "select" &&
      /Id$/.test(field.name) &&
      initial[field.name] &&
      !field.options?.some((o) => Number(o.value) === Number(initial[field.name]))
    ) {
      field.options = [
        { value: initial[field.name], label: `Selected #${initial[field.name]}` },
        ...(field.options || []),
      ];
    }
  }

  return (
    <WorkflowForm
      title={`${record ? "Edit" : "New"} ${isNotice ? "notice" : isIncident ? "incident report" : isItem ? "found item" : "lost report"}`}
      fields={fields}
      initial={initial}
      onClose={onClose}
      onSubmit={async (values) => {
        const body = { ...values };
        if (isNotice) {
          body.audience = audienceGroups.find((g) => g.value === body.audienceGroup)?.roles || [];
          delete body.audienceGroup;
        }
        if (!access.office && body.jobId)
          body.bookingId = lookups?.jobs.find((j) => j.id === body.jobId)?.bookingId;
        if (defaults.assignmentId && isIncident) body.assignmentId = Number(defaults.assignmentId);
        if (body.claimantName !== undefined) {
          body.claimant = {
            name: body.claimantName,
            contact: body.claimantContact,
            notes: body.handlingNotes,
          };
          delete body.claimantName;
          delete body.claimantContact;
          delete body.handlingNotes;
        }
        if (record) body.version = record.version;
        const saved = await mutate({
          resource,
          ...(record
            ? { id: record.id, ...(isNotice ? { method: "PATCH" as const } : { action: "update" }) }
            : {}),
          body,
        }).unwrap();

        const targetId = record?.id || saved.id;

        // Automatically upload any attached images/files
        if (pendingFiles.length > 0) {
          const parentKey = isNotice
            ? "noticeId"
            : isIncident
              ? "incidentId"
              : isItem
                ? "itemId"
                : "reportId";
          for (const file of pendingFiles) {
            await uploadAttachment({ parent: { [parentKey]: targetId }, file }).unwrap();
          }
        }

        onSaved(targetId);
      }}
      afterFields={
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-800">
              {isNotice
                ? "Add images or attachments"
                : isIncident
                  ? "Photos & Evidence"
                  : "Item photos"}
            </label>
            <span className="text-xs text-slate-400">Optional · JPG, PNG, WebP, PDF</span>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 hover:border-red-400 hover:bg-red-50/20 transition-colors">
            <svg
              className="mb-1 h-6 w-6 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs font-semibold text-red-600">
              Choose images or click to upload
            </span>
            <span className="text-[11px] text-slate-400">Files will be attached when you save</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const newFiles = Array.from(e.target.files);
                  setPendingFiles((prev) => [...prev, ...newFiles].slice(0, 10));
                }
                e.target.value = "";
              }}
            />
          </label>

          {pendingFiles.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
              {pendingFiles.map((file, idx) => (
                <PendingFilePreview
                  key={`${file.name}-${idx}`}
                  file={file}
                  onRemove={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
          )}
        </div>
      }
    >
      {!isNotice && (
        <div className="rounded-xl bg-slate-50 p-3">
          <label className="text-xs text-slate-500" htmlFor="lookup-search">
            Find a vehicle, employee, customer or job
          </label>
          <Input
            id="lookup-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search available records…"
          />
          {isError && (
            <p className="text-sm text-red-600">
              Lookups could not load. Try another search or reopen the form.
            </p>
          )}
        </div>
      )}
    </WorkflowForm>
  );
}
