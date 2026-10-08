// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return void 0;
  }, obj);
}
__name(getNestedValue, "getNestedValue");
var HttpUpstreamAdapter = class {
  static {
    __name(this, "HttpUpstreamAdapter");
  }
  config;
  constructor(config) {
    this.config = config;
  }
  async send(request) {
    const { requestMapping } = this.config;
    const body = { ...requestMapping.fixedParams };
    body[requestMapping.toField] = request.to;
    body[requestMapping.contentField] = request.content;
    body[requestMapping.signatureField] = request.signature;
    if (requestMapping.templateIdField && request.templateId) {
      body[requestMapping.templateIdField] = request.templateId;
    }
    if (requestMapping.variablesField && request.variables) {
      body[requestMapping.variablesField] = JSON.stringify(request.variables);
    }
    const headers = {
      "Content-Type": "application/json",
      ...this.config.headers
    };
    if (this.config.authType === "bearer") {
      headers["Authorization"] = `Bearer ${this.config.authValue}`;
    } else if (this.config.authType === "basic") {
      headers["Authorization"] = `Basic ${this.config.authValue}`;
    } else if (this.config.authType === "api_key") {
      headers["X-API-Key"] = this.config.authValue;
    }
    try {
      const response = await fetch(this.config.apiUrl, {
        method: this.config.method,
        headers,
        body: JSON.stringify(body)
      });
      const responseData = await response.json();
      const { responseMapping } = this.config;
      const successValue = getNestedValue(responseData, responseMapping.successPath);
      const success = String(successValue) === responseMapping.successValue;
      const upstreamMessageId = getNestedValue(responseData, responseMapping.messageIdPath);
      const errorCode = responseMapping.errorCodePath ? getNestedValue(responseData, responseMapping.errorCodePath) : void 0;
      const errorMessage2 = responseMapping.errorMessagePath ? getNestedValue(responseData, responseMapping.errorMessagePath) : void 0;
      return {
        success,
        upstreamMessageId: upstreamMessageId ? String(upstreamMessageId) : void 0,
        errorCode: errorCode ? String(errorCode) : void 0,
        errorMessage: errorMessage2 ? String(errorMessage2) : void 0,
        rawResponse: responseData
      };
    } catch (err) {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: err instanceof Error ? err.message : "unknown error",
        rawResponse: null
      };
    }
  }
  parseReceipt(payload) {
    const { receiptMapping } = this.config;
    const upstreamMessageId = String(getNestedValue(payload, receiptMapping.messageIdPath) || "");
    const toNumber = receiptMapping.phonePath ? String(getNestedValue(payload, receiptMapping.phonePath) || "") : void 0;
    const rawStatus = String(getNestedValue(payload, receiptMapping.statusPath) || "");
    const status = receiptMapping.statusMap[rawStatus] || "unknown";
    const errorCode = receiptMapping.errorCodePath ? getNestedValue(payload, receiptMapping.errorCodePath) : void 0;
    const errorMessage2 = receiptMapping.errorMessagePath ? getNestedValue(payload, receiptMapping.errorMessagePath) : void 0;
    return {
      upstreamMessageId,
      toNumber,
      status,
      errorCode: errorCode ? String(errorCode) : void 0,
      errorMessage: errorMessage2 ? String(errorMessage2) : void 0,
      rawPayload: payload
    };
  }
  async verifyWebhookSignature(headers, body) {
    if (!this.config.webhookSecret) return false;
    const signature = headers["x-signature"] || headers["x-webhook-signature"] || "";
    const sharedSecret = headers["x-webhook-secret"] || "";
    const expectedSignature = await hmacSign(this.config.webhookSecret, body);
    return await safeEqual(signature, expectedSignature) || await safeEqual(sharedSecret, this.config.webhookSecret);
  }
};
