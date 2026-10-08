// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function apiKeyAuth() {
  return async (c, next) => {
    const accessKey = c.req.header("X-Access-Key");
    const timestamp = c.req.header("X-Timestamp");
    const nonce = c.req.header("X-Nonce");
    const signature = c.req.header("X-Signature");
    if (!accessKey || !timestamp || !nonce || !signature) {
      return unauthorized("missing required auth headers");
    }
    if (nonce.length > 128) {
      return unauthorized("invalid nonce");
    }
    const now = Math.floor(Date.now() / 1e3);
    const reqTime = parseInt(timestamp, 10);
    if (isNaN(reqTime) || Math.abs(now - reqTime) > 300) {
      return unauthorized("request timestamp expired");
    }
    const apiKey = await c.env.DB.prepare(`
      SELECT ak.*, u.status AS user_status
      FROM api_keys ak
      JOIN users u ON u.id = ak.user_id
      WHERE ak.access_key = ? AND ak.status = ?
    `).bind(accessKey, "active").first();
    if (!apiKey) {
      return unauthorized("invalid api key");
    }
    if (apiKey.user_status !== "active") {
      return unauthorized("user is disabled or does not exist");
    }
    if (apiKey.ip_allowlist) {
      const clientIp = c.req.header("CF-Connecting-IP") || c.req.header("X-Real-IP") || "";
      const allowedIps = apiKey.ip_allowlist.split(",").map((s) => s.trim());
      if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
        return unauthorized("ip not in allowlist");
      }
    }
    const body = await c.req.raw.clone().text();
    const bodyHash = await sha256(body || "");
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const message = `${method}
${path}
${timestamp}
${nonce}
${bodyHash}`;
    if (!apiKey.signing_key_encrypted) {
      return unauthorized("api key must be rotated");
    }
    const signingKey = await decryptText(c.env.CONFIG_ENCRYPTION_KEY, apiKey.signing_key_encrypted);
    const expectedSignature = await hmacSign(signingKey, message);
    if (!await safeEqual(signature, expectedSignature)) {
      return unauthorized("invalid signature");
    }
    const nowText = nowISO();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    await c.env.DB.prepare("DELETE FROM api_key_nonces WHERE expires_at < ?").bind(nowText).run();
    const nonceResult = await c.env.DB.prepare(`
      INSERT OR IGNORE INTO api_key_nonces (access_key, nonce, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(accessKey, nonce, expiresAt, nowText).run();
    if (nonceResult.meta.changes === 0) {
      return unauthorized("replayed request");
    }
    await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(nowText, apiKey.id).run();
    c.set("userId", apiKey.user_id);
    c.set("userRole", "user");
    await next();
  };
}
__name(apiKeyAuth, "apiKeyAuth");
