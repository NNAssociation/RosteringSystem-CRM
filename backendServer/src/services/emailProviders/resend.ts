import type { TransactionalEmailProvider, SendEmailPayload, SendEmailResult } from "./types.js";
import { prisma } from "../../db.js";

export class ResendProvider implements TransactionalEmailProvider {
  readonly name = "Resend";

  isConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY &&
      (process.env.RESEND_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL)
    );
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const fromAddress =
      process.env.RESEND_SENDER_EMAIL || payload.sender.email;
    const from = payload.sender.name
      ? `${payload.sender.name} <${fromAddress}>`
      : fromAddress;

    const resendBody: any = {
      from,
      to: payload.to.map((t) => t.email),
      subject: payload.subject,
      html: payload.htmlContent,
      headers: {
        "X-Entity-Ref-ID": payload.deliveryId,
      },
    };
    if (payload.replyTo?.email) {
      resendBody.reply_to = payload.replyTo.email;
    }
    if (payload.attachment?.length) {
      resendBody.attachments = payload.attachment.map((a) => ({
        filename: a.name,
        content: a.content, // base64 string
      }));
    }
    if (payload.tags?.length) {
      resendBody.tags = payload.tags.map((t) => ({ name: "category", value: t }));
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
      signal: AbortSignal.timeout(20000),
    });

    const body = (await response.json()) as any;
    return {
      ok: response.ok,
      status: response.status,
      messageId: body?.id,
      code: body?.name || body?.message,
    };
  }

  async handleWebhookEvent(body: any): Promise<void> {
    const event = body?.type;
    const data = body?.data;
    if (!event || !data) return;

    const states: Record<string, string> = {
      "email.sent": "SENT",
      "email.delivered": "DELIVERED",
      "email.bounced": "BOUNCED",
      "email.complained": "BLOCKED",
    };
    const mappedStatus = states[event];
    if (!mappedStatus) return;

    const providerMessageId = data.email_id || data.id;
    const recipient = Array.isArray(data.to) ? data.to[0] : data.to;

    const match = await prisma.emailDelivery.findFirst({
      where: {
        OR: [
          ...(providerMessageId ? [{ providerMessageId }] : []),
        ],
      },
    });

    if (!match) return;
    if (recipient && match.recipient.toLowerCase() !== String(recipient).toLowerCase()) return;

    const at = data.created_at ? new Date(data.created_at) : new Date();
    if (match.status === "DELIVERED" || (match.lastEventAt && at <= match.lastEventAt)) return;

    await prisma.emailDelivery.updateMany({
      where: { id: match.id, OR: [{ lastEventAt: null }, { lastEventAt: { lt: at } }] },
      data: {
        status: mappedStatus,
        providerMessageId: providerMessageId || match.providerMessageId,
        lastEventAt: at,
        ...(mappedStatus === "DELIVERED" ? { deliveredAt: at, lastError: null } : {}),
      },
    });
  }
}
