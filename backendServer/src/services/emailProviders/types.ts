export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  name: string;
  content: string; // base64 encoded
  contentType?: string;
}

export interface SendEmailPayload {
  sender: { email: string; name: string };
  replyTo?: { email: string };
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  attachment?: EmailAttachment[];
  tags?: string[];
  deliveryId: string;
}

export interface SendEmailResult {
  ok: boolean;
  status: number;
  messageId?: string;
  code?: string;
}

export interface TransactionalEmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: SendEmailPayload): Promise<SendEmailResult>;
  handleWebhookEvent?(body: any): Promise<void>;
}
