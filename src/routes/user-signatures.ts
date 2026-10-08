// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var userSignatures = new Hono2();
userSignatures.use("*", jwtAuth());
userSignatures.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.name) {
    return fail("name is required");
  }
  const id = uuidv7();
  const now = nowISO();
  await c.env.DB.prepare(
    "INSERT INTO sms_signatures (id, user_id, name, purpose, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, body.name, body.purpose || null, "pending", now, now).run();
  return ok({ id, name: body.name, status: "pending", createdAt: now });
});
userSignatures.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM sms_signatures WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return ok(rows.results);
});
userSignatures.get("/:id", async (c) => {
  const userId = c.get("userId");
  const sigId = c.req.param("id");
  const sig = await c.env.DB.prepare(
    "SELECT * FROM sms_signatures WHERE id = ? AND user_id = ?"
  ).bind(sigId, userId).first();
  if (!sig) return fail("signature not found");
  return ok(sig);
});
userSignatures.put("/:id", async (c) => {
  const userId = c.get("userId");
  const sigId = c.req.param("id");
  const body = await c.req.json();
  const sig = await c.env.DB.prepare(
    "SELECT * FROM sms_signatures WHERE id = ? AND user_id = ?"
  ).bind(sigId, userId).first();
  if (!sig) return fail("signature not found");
  const now = nowISO();
  await c.env.DB.prepare(
    "UPDATE sms_signatures SET name = ?, purpose = ?, status = ?, reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?"
  ).bind(body.name, body.purpose || null, "pending", now, sigId).run();
  return ok({ id: sigId, status: "pending", updatedAt: now });
});
var user_signatures_default = userSignatures;
