import PDFDocument from "pdfkit";
export const money = (amount: number, currency: string) => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount / 100);
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function tripDate(value: string, zone: string) { return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value)); }
export async function quotationPdf(q: any): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", c => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const s = q.snapshot;
  doc.fontSize(22).text(s.companyName).moveDown(0.5);
  doc.fontSize(16).text(`Quotation Q-${q.id} / Revision ${q.revision}`).moveDown();
  doc.fontSize(10).text(`Prepared for ${s.customerName || s.customerEmail}`).text(s.customerEmail);
  doc.text(`Valid until ${tripDate(q.expiresAt, s.timeZone)} (${s.timeZone})`).moveDown();
  doc.fontSize(13).text(s.subject).moveDown(0.5);
  doc.fontSize(10).text(`${s.startLocation} to ${s.endLocation}`);
  for (const stop of s.stops || []) doc.text(`Via: ${stop.address}`);
  doc.text(`Departure: ${tripDate(s.startDateTime, s.timeZone)}`).text(`Arrival: ${tripDate(s.endDateTime, s.timeZone)}`);
  if (s.returnDateTime) doc.text(`Return departure: ${tripDate(s.returnDateTime, s.timeZone)}`);
  if (s.recurrenceRule) doc.text(`Repeats ${s.recurrenceRule.type}, ${s.recurrenceRule.startDate} to ${s.recurrenceRule.endDate}${s.recurrenceRule.days?.length ? "; weekdays: " + s.recurrenceRule.days.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ") : ""}`);
  doc.text(`${s.passengerCount} passengers | ${s.noOfVehicles} vehicles | ${s.tripCount} trip legs`).moveDown();
  for (const item of q.items) {
    if (doc.y > 680) doc.addPage();
    doc.text(`${item.description}\n${item.quantity} x ${money(item.unitPriceMinor, q.currency)} = ${money(item.totalMinor, q.currency)}`).moveDown(0.5);
  }
  doc.moveDown().text(`Subtotal: ${money(q.subtotalMinor, q.currency)}`).text(`Discount: ${money(q.discountMinor, q.currency)}`).text(`Tax (${q.taxBasisPoints / 100}%): ${money(q.taxMinor, q.currency)}`);
  doc.fontSize(14).text(`Total: ${money(q.totalMinor, q.currency)}`).moveDown();
  doc.fontSize(10).text(q.message || "").moveDown().text("Terms").text(q.terms || "No additional terms.");
  if (q.respondedAt) doc.moveDown().text(`${q.status} by ${q.respondentName} on ${tripDate(q.respondedAt, s.timeZone)}`);
  doc.end(); return done;
}
export function quotationEmail(q: any, url?: string, response = false) {
  const s = q.snapshot;
  return `<html><body style="font-family:Arial,sans-serif;color:#172033;max-width:640px;margin:32px auto;padding:24px"><h2>${escapeHtml(s.companyName)}</h2><h1>${response ? `Quotation ${q.status.toLowerCase()}` : "Your trip quotation"}</h1><p>Hello ${escapeHtml(s.customerName || "there")},</p><p style="white-space:pre-wrap">${escapeHtml(q.message)}</p><p><strong>${escapeHtml(s.subject)}</strong><br>${escapeHtml(s.startLocation)} &rarr; ${escapeHtml(s.endLocation)}<br>${escapeHtml(tripDate(s.startDateTime, s.timeZone))} (${escapeHtml(s.timeZone)})</p><h2>${escapeHtml(money(q.totalMinor, q.currency))}</h2>${response ? `<p>Your response has been recorded.${q.status === "ACCEPTED" ? " Your booking is confirmed and our team will arrange your transport." : " Please contact us if you would like a revised quotation."}</p>` : `<p>Valid until ${escapeHtml(tripDate(q.expiresAt, s.timeZone))}. Please review the attached quotation and terms.</p><p><a style="display:inline-block;background:#172033;color:white;padding:14px 20px;border-radius:8px" href="${escapeHtml(url)}">Review &amp; accept</a> <a style="display:inline-block;padding:14px" href="${escapeHtml(url)}?intent=decline">Decline</a></p><p>Your decision will only be recorded after you confirm it on the quotation page.</p>`}</body></html>`;
}
