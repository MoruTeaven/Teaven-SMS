// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var webhooks = new Hono2();
function readWebhookSecret(configJson) {
  try {
    const config = JSON.parse(configJson);
    return config.webhookSecret || null;
  } catch {
    return null;
  }
}
__name(readWebhookSecret, "readWebhookSecret");
webhooks.post("/upstreams/:code", async (c) => {
  const upstreamCode = c.req.param("code");
  const upstream = await c.env.DB.prepare("SELECT * FROM upstreams WHERE code = ? AND status = ?").bind(upstreamCode, "active").first();
  if (!upstream) {
    return fail("upstream not found", 1, 404);
  }
  const headers = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const rawBody = await c.req.raw.clone().text();
  const registry = new AdapterRegistry();
  const configJson = await decryptText(c.env.CONFIG_ENCRYPTION_KEY, upstream.config_encrypted);
  registry.loadFromConfig(upstreamCode, upstream.adapter_type, configJson);
  const adapter = registry.get(upstreamCode);
  if (!adapter) {
    return fail("adapter not found", 1, 500);
  }
  if (!await adapter.verifyWebhookSignature(headers, rawBody)) {
    return fail("invalid webhook signature", 401, 401);
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail("invalid json payload");
  }
  try {
    await c.env.SMS_RECEIPT_QUEUE.send({
      upstreamCode,
      payload
    });
    return ok({ received: true });
  } catch (err) {
    console.error("webhook queue error:", err);
    return fail("failed to enqueue receipt");
  }
});
webhooks.get("/upstreams/:code", async (c) => {
  const upstreamCode = c.req.param("code");
  const upstream = await c.env.DB.prepare("SELECT * FROM upstreams WHERE code = ? AND status = ?").bind(upstreamCode, "active").first();
  if (!upstream) {
    return fail("upstream not found", 1, 404);
  }
  const registry = new AdapterRegistry();
  const configJson = await decryptText(c.env.CONFIG_ENCRYPTION_KEY, upstream.config_encrypted);
  const webhookSecret = readWebhookSecret(configJson);
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token") || c.req.header("X-Webhook-Secret") || "";
  if (!webhookSecret || !await safeEqual(token, webhookSecret)) {
    return fail("invalid webhook signature", 401, 401);
  }
  registry.loadFromConfig(upstreamCode, upstream.adapter_type, configJson);
  const adapter = registry.get(upstreamCode);
  if (!adapter) {
    return fail("adapter not found", 1, 500);
  }
  const payload = {
    t: url.searchParams.get("t") || "",
    m: url.searchParams.get("m") || "",
    s: url.searchParams.get("s") || "",
    d: url.searchParams.get("d") || ""
  };
  try {
    await c.env.SMS_RECEIPT_QUEUE.send({
      upstreamCode,
      payload
    });
    return new Response("0", {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  } catch (err) {
    console.error("webhook queue error:", err);
    return fail("failed to enqueue receipt");
  }
});
var webhooks_default = webhooks;
