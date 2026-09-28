import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  emailDelivery: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));
vi.mock("../db.js", () => ({ prisma: db }));

describe("Email Providers Abstraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("selects Brevo by default or when explicitly requested", async () => {
    const { getEmailProvider } = await import("../services/emailProviders/index.js");
    expect(getEmailProvider().name).toBe("Brevo");

    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    expect(getEmailProvider().name).toBe("Brevo");
  });

  it("selects Resend when configured in environment", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    const { getEmailProvider } = await import("../services/emailProviders/index.js");
    expect(getEmailProvider().name).toBe("Resend");
  });

  it("formats and submits payload correctly with Resend provider", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_SENDER_EMAIL", "sender@transport.test");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-msg-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ResendProvider } = await import("../services/emailProviders/resend.js");
    const provider = new ResendProvider();
    expect(provider.isConfigured()).toBe(true);

    const result = await provider.send({
      sender: { name: "VIP Transport", email: "bookings@transport.test" },
      to: [{ email: "client@example.com" }],
      subject: "Your Quotation",
      htmlContent: "<p>Hello</p>",
      attachment: [{ name: "quote.pdf", content: "JVBERi0xLjQK..." }],
      tags: ["quote-123"],
      deliveryId: "del-456",
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("resend-msg-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        }),
      })
    );

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const callBody = JSON.parse(String(call?.[1]?.body));
    expect(callBody.from).toBe("VIP Transport <sender@transport.test>");
    expect(callBody.to).toEqual(["client@example.com"]);
    expect(callBody.attachments?.[0]?.filename).toBe("quote.pdf");
    expect(callBody.headers?.["X-Entity-Ref-ID"]).toBe("del-456");
  });

  it("handles Resend webhook delivery event", async () => {
    db.emailDelivery.findFirst.mockResolvedValue({
      id: "del-1",
      recipient: "client@example.com",
      status: "SENT",
      lastEventAt: null,
    });

    const { ResendProvider } = await import("../services/emailProviders/resend.js");
    const provider = new ResendProvider();

    await provider.handleWebhookEvent({
      type: "email.delivered",
      data: {
        email_id: "resend-msg-123",
        to: ["client@example.com"],
        created_at: "2026-09-27T10:00:00Z",
      },
    });

    expect(db.emailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "del-1" }),
        data: expect.objectContaining({
          status: "DELIVERED",
          deliveredAt: expect.any(Date),
        }),
      })
    );
  });
});
