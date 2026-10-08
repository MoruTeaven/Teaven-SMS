// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var SmsbaoAdapter = class {
  static {
    __name(this, "SmsbaoAdapter");
  }
  config;
  apiUrl;
  constructor(config) {
    this.config = config;
    this.apiUrl = config.apiUrl || "https://api.smsbao.com";
  }
  async send(request) {
    const content = request.signature ? `\u3010${request.signature}\u3011${request.content}` : request.content;
    const passwordMd5 = this.md5(this.config.password);
    const params = new URLSearchParams({
      u: this.config.username,
      p: passwordMd5,
      m: request.to.replace(/^\+86/, ""),
      // å»æ +86 åç¼
      c: content
    });
    const url = `${this.apiUrl}/sms?${params.toString()}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "text/plain"
        }
      });
      const responseText = (await response.text()).trim();
      const success = responseText === "0";
      const errorMap = {
        "0": "success",
        "-1": "missing_params",
        "-2": "server_error",
        "30": "wrong_password",
        "40": "account_not_found",
        "41": "insufficient_balance",
        "42": "account_expired",
        "43": "ip_restricted",
        "50": "sensitive_content",
        "51": "invalid_phone",
        "60": "not_charged"
      };
      return {
        success,
        errorCode: success ? void 0 : errorMap[responseText] || `smsbao_${responseText}`,
        errorMessage: success ? void 0 : `smsbao error: ${responseText}`,
        rawResponse: { code: responseText }
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
    const data = payload;
    const taskId = data.t || "";
    const statusStr = data.s || "";
    const detail = data.d || "";
    let status = "unknown";
    if (statusStr === "1") {
      status = "delivered";
    } else if (statusStr === "-1") {
      status = "failed";
    }
    return {
      upstreamMessageId: taskId,
      toNumber: data.m || void 0,
      status,
      errorCode: status === "failed" ? detail : void 0,
      errorMessage: status === "failed" ? detail : void 0,
      rawPayload: payload
    };
  }
  async verifyWebhookSignature(headers, body) {
    if (!this.config.webhookSecret) return false;
    const sharedSecret = headers["x-webhook-secret"] || "";
    if (await this.safeEqual(sharedSecret, this.config.webhookSecret)) return true;
    const signature = headers["x-signature"] || headers["x-webhook-signature"] || "";
    const expected = await this.hmacSign(this.config.webhookSecret, body);
    return this.safeEqual(signature, expected);
  }
  async hmacSign(secret, message) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
    return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async safeEqual(a, b) {
    const encoder = new TextEncoder();
    const [aHash, bHash] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(a)),
      crypto.subtle.digest("SHA-256", encoder.encode(b))
    ]);
    const left = new Uint8Array(aHash);
    const right = new Uint8Array(bHash);
    let diff = left.length ^ right.length;
    for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
    return diff === 0;
  }
  md5(message) {
    const r = message;
    const n = r.length;
    const o = [];
    for (let t = 0; t < n; t++) {
      o[t >> 2] |= (r.charCodeAt(t) & 255) << (t % 4 << 3);
    }
    o[n >> 2] |= 128 << (n % 4 << 3);
    o[(n + 8 >> 6 << 4) + 14] = n;
    const a = [1732584193, -271733879, -1732584194, 271733878];
    const s = [
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      7,
      12,
      17,
      22,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      5,
      9,
      14,
      20,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      4,
      11,
      16,
      23,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21,
      6,
      10,
      15,
      21
    ];
    const c = [
      -680876936,
      -389564586,
      606105819,
      -1044525330,
      -176418897,
      1200080426,
      -1473231341,
      -45705983,
      1770035416,
      -1958414417,
      -42063,
      -1990404162,
      1804603682,
      -40341101,
      -1502002290,
      1236535329,
      -165796510,
      -1069501632,
      643717713,
      -373897302,
      -701558691,
      38016083,
      -660478335,
      -405537848,
      568446438,
      -1019803690,
      -187363961,
      1163531501,
      -1444681467,
      -51403784,
      1735328473,
      -1926607734,
      -378558,
      -2022574463,
      1839030562,
      -35309556,
      -1530992060,
      1272893353,
      -155497632,
      -1094730640,
      681279174,
      -358537222,
      -722521979,
      76029189,
      -640364487,
      -421815835,
      530742520,
      -995338651,
      -198630844,
      1126891415,
      -1416354905,
      -57434055,
      1700485571,
      -1894986606,
      -1051523,
      -2054922799,
      1873313359,
      -30611744,
      -1560198380,
      1309151649,
      -145523070,
      -1120210371,
      718787259,
      -343485551
    ];
    for (let f = 0; f < o.length; f += 16) {
      const l = a[0];
      const h = a[1];
      const d = a[2];
      const u = a[3];
      for (let p = 0; p < 64; p++) {
        let g;
        let m;
        if (p < 16) {
          g = h & d | ~h & a[0];
          m = p;
        } else if (p < 32) {
          g = h & a[0] | d & ~h;
          m = (5 * p + 1) % 16;
        } else if (p < 48) {
          g = h ^ d ^ a[0];
          m = (3 * p + 5) % 16;
        } else {
          g = d ^ (h | ~a[0]);
          m = 7 * p % 16;
        }
        const v = a[0] + g + o[f + m] + c[p];
        const y = (v << s[p] | v >>> 32 - s[p]) + h;
        a[0] = a[3];
        a[3] = a[2];
        a[2] = a[1];
        a[1] = y;
      }
      a[0] += l;
      a[1] += h;
      a[2] += d;
      a[3] += u;
    }
    return [a[0], a[1], a[2], a[3]].map((t) => {
      let n2 = "";
      for (let o2 = 0; o2 < 4; o2++) {
        n2 += (t >> (o2 << 3) & 255).toString(16).padStart(2, "0");
      }
      return n2;
    }).join("");
  }
};
