import type { TransactionalEmailProvider } from "./types.js";
import { BrevoProvider } from "./brevo.js";
import { ResendProvider } from "./resend.js";

const brevo = new BrevoProvider();
const resend = new ResendProvider();

export function getEmailProvider(): TransactionalEmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  if (provider === "resend") {
    return resend;
  }
  return brevo;
}

export * from "./types.js";
export * from "./brevo.js";
export * from "./resend.js";
