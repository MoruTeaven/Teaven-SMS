// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var apiKeys = new Hono2();
apiKeys.use("*", jwtAuth());
apiKeys.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.name) {
    return fail("name is required");
  }
  const id = uuidv7();
  const accessKey = generateAccessKey();
  const secret = generateSecret();
  const secretVerifier = await sha256(secret);
  const signingKeyEncrypted = await encryptText(c.env.CONFIG_ENCRYPTION_KEY, secret);
  const now = nowISO();
  await c.env.DB.prepare(
    `INSERT INTO api_keys (
      id, user_id, access_key, secret_hash, secret_verifier, signing_key_encrypted,
      name, ip_allowlist, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    accessKey,
    secretVerifier,
    secretVerifier,
    signingKeyEncrypted,
    body.name,
    body.ipAllowlist || null,
    "active",
    now
  ).run();
  return ok({
    id,
    accessKey,
    secret,
    name: body.name,
    createdAt: now
  }, "api key created. store the secret now, it will not be shown again.");
});
apiKeys.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    "SELECT id, access_key, name, ip_allowlist, status, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return ok(rows.results);
});
apiKeys.patch("/:id/status", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id");
  const body = await c.req.json();
  const key = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ? AND user_id = ?").bind(keyId, userId).first();
  if (!key) {
    return fail("api key not found");
  }
  await c.env.DB.prepare("UPDATE api_keys SET status = ? WHERE id = ?").bind(body.status, keyId).run();
  return ok({ id: keyId, status: body.status });
});
apiKeys.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id");
  const key = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ? AND user_id = ?").bind(keyId, userId).first();
  if (!key) {
    return fail("api key not found");
  }
  await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(keyId).run();
  return ok({ id: keyId }, "api key deleted");
});
var api_keys_default = apiKeys;
