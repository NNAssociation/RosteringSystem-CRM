"use client";
import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useGetWorkplaceNotificationsQuery,
  useGetWorkplaceRecordQuery,
  useReadWorkplaceNotificationMutation,
  type WorkplaceResource,
} from "@/services/api/workplace.api";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import Link from "next/link";
import { useRef, useState } from "react";
import { featureEnabled, useEmployeeAccess } from "./access";
import { Attachments } from "./attachments";

interface Notification {
  id: number;
  title: string;
  href: string;
  entity: string;
  entityId: number;
  createdAt: string;
  readAt?: string | null;
  priority?: string;
  category?: string;
}

const resources: Record<string, WorkplaceResource> = {
  Notice: "notices",
  Incident: "incidents",
  FoundPropertyItem: "lost-property/items",
  LostPropertyReport: "lost-property/reports",
};
const priorities = {
  CRITICAL: {
    label: "Critical",
    card: "border-l-red-500 bg-red-50/70 hover:bg-red-100/70",
    tag: "border-red-200 bg-red-100 text-red-800",
    header: "bg-red-50 border-red-100",
  },
  WARNING: {
    label: "Warning",
    card: "border-l-amber-500 bg-amber-50/70 hover:bg-amber-100/70",
    tag: "border-amber-200 bg-amber-100 text-amber-900",
    header: "bg-amber-50 border-amber-100",
  },
  GOOD_NEWS: {
    label: "Good News",
    card: "border-l-emerald-500 bg-emerald-50/70 hover:bg-emerald-100/70",
    tag: "border-emerald-200 bg-emerald-100 text-emerald-800",
    header: "bg-emerald-50 border-emerald-100",
  },
  INFORMATION: {
    label: "Information",
    card: "border-l-sky-500 bg-sky-50/70 hover:bg-sky-100/70",
    tag: "border-sky-200 bg-sky-100 text-sky-800",
    header: "bg-sky-50 border-sky-100",
  },
};
const priorityStyle = (value?: string) =>
  priorities[value as keyof typeof priorities] || priorities.INFORMATION;
function PriorityTag({ value }: { value?: string }) {
  const style = priorityStyle(value);
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.tag}`}
    >
      {style.label}
    </span>
  );
}

function NotificationPopup({
  item,
  onClose,
  restoreFocus,
}: {
  item: Notification;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const { timeZone } = useEmployeeAccess();
  const resource = resources[item.entity];
  const {
    currentData: record,
    isFetching,
    isError,
    refetch,
  } = useGetWorkplaceRecordQuery(
    { resource: resource || "notices", id: item.entityId },
    { skip: !resource, refetchOnMountOrArgChange: true },
  );
  const revision = !isError ? record?.revisions?.[0] : undefined;
  const title = resource === "notices" ? revision?.title || item.title : item.title;
  const priority = revision?.priority || item.priority;
  const category = revision?.category || item.category;
  const message = resource === "notices" ? revision?.body : record?.description;
  const parentKey =
    resource === "notices"
      ? "noticeId"
      : resource === "incidents"
        ? "incidentId"
        : resource === "lost-property/items"
          ? "itemId"
          : "reportId";

  return (
    <DialogBox
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      maxWidth="sm:max-w-[640px]"
      headerClassName={`pr-12 break-words ${priorityStyle(priority).header}`}
      contentClassName="max-h-[65vh] overflow-y-auto space-y-5"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocus();
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {item.href.startsWith("/dashboard/") && (
            <Button asChild>
              <Link href={item.href} onClick={onClose}>
                View full details
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <PriorityTag value={priority} />
        {category && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {category.replaceAll("_", " ")}
          </span>
        )}
      </div>
      <DialogDescription>
        {new Date(item.createdAt).toLocaleString(undefined, { timeZone })}
      </DialogDescription>
      {isError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-slate-600">
            Unable to load the full message. The record may no longer be available.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isFetching && !record ? (
        <p role="status" className="text-sm text-slate-500">
          Loading message…
        </p>
      ) : (
        <>
          {record && resource && (
            <Attachments
              parent={{ [parentKey]: item.entityId }}
              editable={false}
              hideEmpty
              expanded
            />
          )}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            {message || item.title}
          </p>
        </>
      )}
    </DialogBox>
  );
}

export function WorkplaceNotifications() {
  const access = useEmployeeAccess();
  const enabled = ["notices", "incidents", "lostProperty"].some((key) =>
    featureEnabled(access, key as any),
  );
  const { data, isError, refetch } = useGetWorkplaceNotificationsQuery(undefined, {
    skip: !enabled,
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const [read] = useReadWorkplaceNotificationMutation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const bell = useRef<HTMLButtonElement>(null);
  if (!enabled) return null;

  function showMessage(item: Notification) {
    setOpen(false);
    setSelected(item);
    if (!item.readAt) void read(item.id);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={bell}
            variant="ghost"
            className="relative"
            aria-label={`Notifications, ${data?.unreadCount || 0} unread`}
          >
            <NotificationsNoneIcon />
            {!!data?.unreadCount && (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
                {data.unreadCount > 99 ? "99+" : data.unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-96 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-auto rounded-2xl"
          onCloseAutoFocus={(event) => {
            if (selected) event.preventDefault();
          }}
        >
          <h3 className="mb-3 font-bold">Notifications</h3>
          {isError ? (
            <Button variant="outline" onClick={() => refetch()}>
              Retry loading notifications
            </Button>
          ) : data?.items.length ? (
            data.items.map((item: Notification) => (
              <button
                type="button"
                key={item.id}
                onClick={() => showMessage(item)}
                className={`mb-2 block w-full rounded-xl border-l-4 p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${priorityStyle(item.priority).card}`}
              >
                <span className="mb-2 flex items-center justify-between gap-2">
                  <PriorityTag value={item.priority} />
                  {!item.readAt && (
                    <span className="text-[10px] font-semibold text-slate-600">Unread</span>
                  )}
                </span>
                <span className="block break-words font-semibold text-slate-900">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString(undefined, {
                    timeZone: access.timeZone,
                  })}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">You’re all caught up.</p>
          )}
        </PopoverContent>
      </Popover>
      {selected && (
        <NotificationPopup
          key={selected.id}
          item={selected}
          onClose={() => setSelected(null)}
          restoreFocus={() => bell.current?.focus()}
        />
      )}
    </>
  );
}
