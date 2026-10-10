"use client";

import { Button } from "@/components/ui/button";
import type { QuotationConfig, QuotationRevision } from "@/types/booking-workflow";
import { CheckCircle2, Download, Mail, Send } from "lucide-react";
import { BookingSectionTitle } from "../BookingVisuals";
import { QuotationPreview } from "../QuotationPreview";

interface Step3Props {
  preview: QuotationRevision;
  current: QuotationRevision;
  quotes: QuotationRevision[];
  config: QuotationConfig | null;
  busy: boolean;
  tripDirty: boolean;
  quoteDirty: boolean;
  onSelectPreviewId: (id: number) => void;
  onDownloadPdf: (id: number) => void;
  onSendQuotation: (id: number) => void;
  onRecordAcceptance?: (id: number) => void;
}

export function BookingStep3PreviewSend({
  preview,
  current,
  quotes,
  config,
  busy,
  tripDirty,
  quoteDirty,
  onSelectPreviewId,
  onDownloadPdf,
  onSendQuotation,
  onRecordAcceptance,
}: Step3Props) {
  const recipientEmail = (preview.snapshot?.customerEmail as string) || "";
  const canSend =
    !busy &&
    !!config?.emailConfigured &&
    !!recipientEmail &&
    preview.id === current.id &&
    ["DRAFT", "SENT"].includes(preview.status) &&
    !quoteDirty &&
    !tripDirty;

  return (
    <div className="space-y-4">
      <BookingSectionTitle
        title="Review & send"
        description="Check the saved quotation and recipient before sending."
        icon={Send}
      />

      <div className="flex flex-wrap justify-between gap-3">
        <select
          aria-label="Quotation revision"
          className="rounded-lg border p-2 text-sm bg-white"
          value={preview.id}
          onChange={(e) => onSelectPreviewId(Number(e.target.value))}
        >
          {quotes.map((q) => (
            <option value={q.id} key={q.id}>
              Revision {q.revision} · {q.status.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <Button variant="outline" disabled={busy} onClick={() => onDownloadPdf(preview.id)}>
          <Download size={16} />
          Download PDF
        </Button>
      </div>

      <QuotationPreview quotation={preview} />

      {!config?.emailConfigured && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Email sending needs Brevo configuration. You can save, download, or directly record
          customer acceptance below.
        </p>
      )}

      <div className="rounded-xl border bg-white p-5 space-y-3">
        {recipientEmail ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Mail size={16} className="text-blue-500" />
            Send to <strong>{recipientEmail}</strong>
          </p>
        ) : (
          <p className="text-sm text-amber-700 font-medium">
            No customer email on this quotation. Add an email address to the customer before
            sending.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button disabled={!canSend} onClick={() => onSendQuotation(preview.id)} className="gap-2">
            <Send size={16} />
            Send quotation via email
          </Button>

          {onRecordAcceptance && preview.status !== "ACCEPTED" && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || quoteDirty || tripDirty}
              onClick={() => onRecordAcceptance(preview.id)}
              className="gap-2 border-emerald-300 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-900"
            >
              <CheckCircle2 size={16} className="text-emerald-600" />
              Record Customer Acceptance (Creates Jobs)
            </Button>
          )}
        </div>

        {(tripDirty || quoteDirty) && (
          <p className="text-sm text-amber-700">
            Save and preview your changes before sending or accepting.
          </p>
        )}
      </div>
    </div>
  );
}
