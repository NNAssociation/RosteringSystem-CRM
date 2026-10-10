"use client";

import { DialogBox } from "@/components/shared/dialog-box";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/api";
import {
  useGetAttachmentsQuery,
  useRemoveAttachmentMutation,
  useUploadAttachmentMutation,
} from "@/services/api/workplace.api";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useEmployeeAccess } from "./access";
import { errorMessage } from "./forms";

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageCard({
  file,
  canRemove,
  onRemove,
  onOpenLightbox,
  onDownload,
  expanded = false,
}: {
  file: any;
  canRemove: boolean;
  onRemove: () => void;
  onOpenLightbox: (url: string, filename: string) => void;
  onDownload: () => void;
  expanded?: boolean;
}) {
  const { getToken } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    async function load() {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/attachments/${file.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load image");
        const blob = await res.blob();
        if (active) {
          url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      } catch {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, getToken]);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div
        className="relative aspect-video w-full cursor-pointer overflow-hidden bg-slate-100"
        onClick={() => blobUrl && onOpenLightbox(blobUrl, file.filename)}
      >
        {loading && (
          <div className="flex h-full w-full animate-pulse items-center justify-center bg-slate-100 text-xs text-slate-400">
            Loading preview…
          </div>
        )}
        {failed && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 p-2 text-center text-xs text-slate-400">
            <svg
              className="mb-1 h-6 w-6 text-slate-300"
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
            <span>Preview unavailable</span>
          </div>
        )}
        {blobUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={blobUrl}
              alt={file.filename}
              className={
                expanded
                  ? "h-full w-full object-contain"
                  : "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              }
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-slate-800 shadow">
                View full size
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800" title={file.filename}>
            {file.filename}
          </p>
          <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            title="Download"
            onClick={onDownload}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </Button>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              title="Remove"
              onClick={onRemove}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocCard({
  file,
  canRemove,
  onRemove,
  onDownload,
}: {
  file: any;
  canRemove: boolean;
  onRemove: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <button
            onClick={onDownload}
            className="truncate text-left text-xs font-semibold text-slate-800 hover:text-red-700 hover:underline block max-w-full"
            title={file.filename}
          >
            {file.filename}
          </button>
          <span className="text-[11px] text-slate-400">{formatFileSize(file.size)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={onDownload} className="text-xs text-slate-600">
          Download
        </Button>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-xs text-rose-600 hover:bg-rose-50"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export function Attachments({
  parent,
  editable = true,
  hideEmpty = false,
  expanded = false,
}: {
  parent: Record<string, number>;
  editable?: boolean;
  hideEmpty?: boolean;
  expanded?: boolean;
}) {
  const { data = [], isError, refetch } = useGetAttachmentsQuery(parent);
  const [upload, uploadState] = useUploadAttachmentMutation();
  const [remove] = useRemoveAttachmentMutation();
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null);
  const { getToken } = useAuth();
  const access = useEmployeeAccess();

  async function download(id: string, filename: string) {
    try {
      setError("");
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/attachments/${id}?download=true`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!response.ok) throw new Error((await response.json()).error || "Download failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" exceeds 10 MB limit`);
        await upload({ parent, file }).unwrap();
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const images = data.filter((f: any) => f.mimeType?.startsWith("image/"));
  const docs = data.filter((f: any) => !f.mimeType?.startsWith("image/"));

  return (
    <section className="space-y-4">
      {isError && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-xs text-red-700">
          <span>Failed to load attachments.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State matching Screenshot 1 */}
      {!hideEmpty && !data.length && !isError && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center bg-slate-50/50">
          <svg
            className="mb-2 h-10 w-10 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-xs font-medium text-slate-400">No photos attached.</p>
        </div>
      )}

      {/* Images Grid */}
      {images.length > 0 && (
        <div
          className={
            expanded
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
          }
        >
          {images.map((file: any) => (
            <ImageCard
              key={file.id}
              file={file}
              expanded={expanded}
              canRemove={Boolean(
                editable && (access.office || file.uploaderId === access.employee.id),
              )}
              onRemove={() => setConfirmId(file.id)}
              onOpenLightbox={(url, filename) => setLightbox({ url, filename })}
              onDownload={() => download(file.id, file.filename)}
            />
          ))}
        </div>
      )}

      {/* Documents List */}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((file: any) => (
            <DocCard
              key={file.id}
              file={file}
              canRemove={Boolean(
                editable && (access.office || file.uploaderId === access.employee.id),
              )}
              onRemove={() => setConfirmId(file.id)}
              onDownload={() => download(file.id, file.filename)}
            />
          ))}
        </div>
      )}

      {/* Confirmation dialog for deletion */}
      {confirmId && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800">
          <p className="font-semibold">Remove this attachment permanently?</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700 h-7 text-xs"
              onClick={async () => {
                try {
                  await remove(confirmId).unwrap();
                  setConfirmId(null);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              Confirm removal
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setConfirmId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Upload Interface */}
      {editable && (
        <div className="pt-1">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-3 hover:border-red-400 hover:bg-red-50/20 transition-colors">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-xs font-semibold text-slate-700">
                {uploadState.isLoading ? "Uploading attachment…" : "Add photo or document"}
              </span>
              <span className="text-[11px] text-slate-400">· JPG, PNG, WebP, PDF up to 10 MB</span>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              disabled={uploadState.isLoading || data.length >= 10}
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Lightbox Preview Modal */}
      {lightbox && (
        <DialogBox
          open
          onOpenChange={(open) => {
            if (!open) setLightbox(null);
          }}
          title={lightbox.filename}
          maxWidth="sm:max-w-4xl"
          contentClassName="p-4"
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="max-h-[75vh] w-full overflow-hidden rounded-xl bg-slate-900 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url}
                alt={lightbox.filename}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
            <div className="flex w-full items-center justify-between border-t border-slate-100 pt-3">
              <span className="truncate text-xs font-medium text-slate-600">
                {lightbox.filename}
              </span>
              <div className="flex gap-2">
                <a
                  href={lightbox.url}
                  download={lightbox.filename}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Save image
                </a>
                <Button variant="outline" size="sm" onClick={() => setLightbox(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogBox>
      )}
    </section>
  );
}
