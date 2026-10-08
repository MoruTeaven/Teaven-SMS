interface Env {
  DB: D1Database;
  KV: KVNamespace;
  SMS_SEND_QUEUE: Queue<SendSmsJob>;
  SMS_RECEIPT_QUEUE: Queue<ReceiptJob>;
  /** 后台实时推送用的 Durable Object（广播中心） */
  MESSAGE_HUB: DurableObjectNamespace;
  JWT_SECRET: string;
  CONFIG_ENCRYPTION_KEY: string;
  API_BASE_URL: string;
}

interface SendSmsJob {
  messageId: string;
  userId: string;
  signatureId: string;
  templateId: string;
  upstreamSignatureMappingId: string;
  upstreamTemplateMappingId: string;
  toNumber: string;
  userContent: string;
  variables: Record<string, string>;
  countryCode?: string;
}

interface ReceiptJob {
  upstreamCode: string;
  payload: unknown;
}
