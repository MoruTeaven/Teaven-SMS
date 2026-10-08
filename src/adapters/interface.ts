export interface UpstreamSendRequest {
  to: string;
  content: string;
  signature: string;
  templateId?: string;
  variables?: Record<string, string>;
  callbackUrl: string;
  countryCode?: string;
}

export interface UpstreamSendResult {
  success: boolean;
  upstreamMessageId?: string;
  upstreamRawStatus?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse: unknown;
}

export interface UpstreamReceiptResult {
  upstreamMessageId: string;
  status: 'delivered' | 'failed' | 'submitted' | 'unknown';
  errorCode?: string;
  errorMessage?: string;
  rawPayload: unknown;
}

export interface UpstreamAdapter {
  send(request: UpstreamSendRequest): Promise<UpstreamSendResult>;
  parseReceipt(payload: unknown): UpstreamReceiptResult;
  verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean>;
}
