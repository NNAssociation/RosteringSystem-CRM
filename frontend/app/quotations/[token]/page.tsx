"use client";
import { use, useEffect, useState } from "react";
import { QuotationPreview } from "@/components/bookings/QuotationPreview";
import { workflowBase } from "@/lib/workflow-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function CustomerQuotation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [q, setQ] = useState<any>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"ACCEPT" | "DECLINE" | null>(null), [name, setName] = useState(""), [reason, setReason] = useState(""), [terms, setTerms] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${workflowBase}/quotations/public/${token}`, { cache: "no-store", signal: controller.signal }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setQ(body); }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    if (new URLSearchParams(window.location.search).get("intent") === "decline") setDecision("DECLINE");
    return () => controller.abort();
  }, [token]);
  async function respond() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${workflowBase}/quotations/public/${token}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, name, reason, acceptTerms: terms }) });
      const body = await r.json(); if (!r.ok) throw new Error(body.error); setQ(body); setDecision(null);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-4xl space-y-6">
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {!q && !error && <p role="status">Loading your quotation…</p>}
    {q && <><div className="flex items-center justify-between gap-4"><p className="font-semibold">{q.booking?.status === "CANCELLED" ? "This booking has been cancelled. Please contact the bookings team for details." : q.booking?.status === "SUPERSEDED" ? "This booking has been replaced by an accepted amendment." : q.status === "ACCEPTED" ? "Thank you — your booking is confirmed." : q.status === "DECLINED" ? "Your quotation has been declined." : q.status === "EXPIRED" ? "This quotation has expired. Please contact the bookings team." : "Review your trip and quotation"}</p><a className="text-sm underline shrink-0" href={`${workflowBase}/quotations/public/${token}/pdf`} referrerPolicy="no-referrer">Download PDF</a></div><QuotationPreview quotation={q} />
    {q.status === "SENT" && <section className="rounded-2xl border bg-white p-6 space-y-5"><h2 className="text-xl font-semibold">Your response</h2><div className="flex gap-3"><Button onClick={() => setDecision("ACCEPT")} variant={decision === "ACCEPT" ? "default" : "outline"}>Accept quotation</Button><Button onClick={() => setDecision("DECLINE")} variant={decision === "DECLINE" ? "default" : "outline"}>Decline</Button></div>{decision && <><label className="block text-sm">Your full name<Input className="mt-2" value={name} onChange={e => setName(e.target.value)} maxLength={200} autoComplete="name" /></label>{decision === "ACCEPT" ? <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-1" />I have reviewed the itinerary, price and terms, and I accept this quotation.</label> : <label className="block text-sm">Reason (optional)<textarea className="block w-full rounded-lg border p-3 mt-2" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>}<Button disabled={busy || name.trim().length < 2 || (decision === "ACCEPT" && !terms)} onClick={respond}>{busy ? "Saving response…" : decision === "ACCEPT" ? "Confirm acceptance" : "Confirm decline"}</Button></>}</section>}
    {q.respondedAt && <p className="text-sm text-slate-500">Response recorded for {q.respondentName}. Please contact the bookings team for any changes.</p>}</>}
  </div></main>;
}
