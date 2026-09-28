import type { TransactionalEmailProvider, SendEmailPayload, SendEmailResult } from "./types.js";
import { prisma } from "../../db.js";

export async function sendBrevoRaw(payload: any): Promise<SendEmailResult> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.json()) as any;
  return { ok: response.ok, status: response.status, messageId: body.messageId, code: body.code };
}

export class BrevoProvider implements TransactionalEmailProvider {
  readonly name = "Brevo";

  isConfigured(): boolean {
    return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const brevoPayload: any = {
      sender: payload.sender,
      to: payload.to,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.attachment?.length ? { attachment: payload.attachment } : {}),
      ...(payload.tags?.length ? { tags: payload.tags } : {}),
    };
    return sendBrevoRaw(brevoPayload);
  }

  async handleWebhookEvent(body: any): Promise<void> {
    for (const e of (Array.isArray(body) ? body : [body]).slice(0, 100)) {
      const states: Record<string, string> = {
        request: "SENT",
        delivered: "DELIVERED",
        hard_bounce: "BOUNCED",
        soft_bounce: "BOUNCED",
        blocked: "BLOCKED",
        invalid_email: "FAILED",
        error: "FAILED",
      };
      if (!states[e.event]) continue;
      const taggedId = (Array.isArray(e.tags) ? e.tags : [])
        .find((t: string) => t.startsWith("delivery-"))
        ?.slice(9);
      const match = await prisma.emailDelivery.findFirst({
        where: {
          OR: [
            ...(e["message-id"] ? [{ providerMessageId: e["message-id"] }] : []),
            ...(taggedId ? [{ id: taggedId }] : []),
          ],
        },
      });
      if (!match || match.recipient.toLowerCase() !== String(e.email).toLowerCase()) continue;
      const seconds = Number(e.ts_event || e.ts);
      if (!Number.isFinite(seconds)) continue;
      const at = new Date(seconds * 1000);
      if (match.status === "DELIVERED" || (match.lastEventAt && at <= match.lastEventAt)) continue;
      await prisma.emailDelivery.updateMany({
        where: { id: match.id, OR: [{ lastEventAt: null }, { lastEventAt: { lt: at } }] },
        data: {
          status: states[e.event],
          providerMessageId: e["message-id"] || match.providerMessageId,
          lastEventAt: at,
          ...(e.event === "delivered" ? { deliveredAt: at, lastError: null } : {}),
        },
      });
    }
  }
}
