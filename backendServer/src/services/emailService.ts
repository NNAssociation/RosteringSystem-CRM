import { prisma } from "../db.js";
import { decryptToken } from "./quotationService.js";
import { quotationEmail, quotationPdf } from "./quotationDocument.js";
import { eventBus } from "../events/eventBus.js";
import type { EventType } from "../events/eventTypes.js";
import { getEmailProvider, BrevoProvider } from "./emailProviders/index.js";

export async function sendBrevo(payload: any) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
  });
  const body = await response.json() as any;
  return { ok: response.ok, status: response.status, messageId: body.messageId, code: body.code };
}
let busy = false;
export async function processWorkflowOutbox() {
  if (busy) return; busy = true;
  try {
    const events = await prisma.workflowEvent.findMany({ where: { publishedAt: null }, take: 100, orderBy: { id: "asc" } });
    for (const event of events) {
      eventBus.publish(event.type as EventType, event.payload);
      await prisma.workflowEvent.update({ where: { id: event.id }, data: { publishedAt: new Date() } });
    }
    await prisma.emailDelivery.updateMany({ where: { status: "SENDING", claimedAt: { lt: new Date(Date.now() - 120000) } }, data: { status: "UNKNOWN", lastError: "Worker stopped during send. Check provider logs before retrying." } });
    const rows = await prisma.emailDelivery.findMany({ where: { status: "QUEUED", nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 10 });
    for (const row of rows) {
      const claimed = await prisma.emailDelivery.updateMany({ where: { id: row.id, status: "QUEUED" }, data: { status: "SENDING", claimedAt: new Date(), attempts: { increment: 1 } } });
      if (!claimed.count) continue;
      let submitted = false;
      try {
        const q = await prisma.quotation.findUnique({ where: { id: row.quotationId }, include: { items: { orderBy: { position: "asc" } } } });
        if (row.kind === "QUOTATION" && (q.status !== "SENT" || q.expiresAt <= new Date())) {
          await prisma.emailDelivery.update({ where: { id: row.id }, data: { status: "CANCELLED" } }); continue;
        }
        const provider = getEmailProvider();
        const senderEmail = process.env.RESEND_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL;
        if (!provider.isConfigured() || !senderEmail) throw new Error(`${provider.name} sender configuration is missing`);
        const responseEmail = row.kind === "RESPONSE";
        const url = responseEmail ? undefined : `${process.env.PUBLIC_APP_URL!.replace(/\/$/, "")}/quotations/${decryptToken(q.tokenCipher)}`;
        const pdf = await quotationPdf(q);
        const payload = { sender: { email: senderEmail, name: process.env.COMPANY_NAME || "Transport Services" },
          ...(process.env.BREVO_REPLY_TO ? { replyTo: { email: process.env.BREVO_REPLY_TO } } : {}),
          to: [{ email: row.recipient }], subject: `${responseEmail ? q.status : "Quotation"} Q-${q.id}: ${q.snapshot.subject}`,
          htmlContent: quotationEmail(q, url, responseEmail), attachment: [{ name: `quotation-${q.id}.pdf`, content: pdf.toString("base64") }], tags: [`delivery-${row.id}`], deliveryId: row.id };
        submitted = true;
        const result = provider.name === "Brevo" ? await sendBrevo(payload) : await provider.send(payload);
        if (!result.ok) {
          const retry = result.status === 429 && row.attempts < 4;
          await prisma.emailDelivery.update({ where: { id: row.id }, data: { status: retry ? "QUEUED" : result.status >= 500 ? "UNKNOWN" : "FAILED", nextAttemptAt: new Date(Date.now() + 60000 * (row.attempts + 1)), lastError: `${provider.name} HTTP ${result.status} (${result.code || "send_error"})` } });
        } else await prisma.emailDelivery.updateMany({ where: { id: row.id, status: "SENDING" }, data: { status: "SENT", providerMessageId: result.messageId, lastError: null } });
      } catch {
        await prisma.emailDelivery.updateMany({ where: { id: row.id, status: "SENDING" }, data: { status: submitted ? "UNKNOWN" : "FAILED", lastError: submitted ? "Delivery outcome unknown. Check provider logs before retrying." : "Unable to prepare email. Check sender configuration." } });
      }
    }
  } finally { busy = false; }
}
export function startWorkflowWorker() {
  const run = () => processWorkflowOutbox().catch(() => console.error("Workflow outbox unavailable. Check database migrations and connectivity."));
  void run(); const timer = setInterval(run, 10000); timer.unref(); return timer;
}
export async function handleBrevoEvent(body: any) {
  const brevo = new BrevoProvider();
  return brevo.handleWebhookEvent(body);
}
