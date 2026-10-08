// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var userTemplates = new Hono2();
userTemplates.use("*", jwtAuth());
userTemplates.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.name || !body.content) {
    return fail("name and content are required");
  }
  const id = uuidv7();
  const now = nowISO();
  const varsSchema = body.variablesSchema ? JSON.stringify(body.variablesSchema) : null;
  await c.env.DB.prepare(
    "INSERT INTO sms_templates (id, user_id, name, content, variables_schema, sms_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, body.name, body.content, varsSchema, body.smsType || "verification", "pending", now, now).run();
  return ok({ id, name: body.name, status: "pending", createdAt: now });
});
userTemplates.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM sms_templates WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return ok(rows.results);
});
userTemplates.get("/public", async (c) => {
  const url = new URL(c.req.url);
  const smsType = url.searchParams.get("smsType");
  let query = "SELECT * FROM public_templates WHERE status = ?";
  const params = ["active"];
  if (smsType) {
    query += " AND sms_type = ?";
    params.push(smsType);
  }
  query += " ORDER BY created_at DESC";
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok(rows.results);
});
userTemplates.post("/public/:id/adopt", async (c) => {
  const userId = c.get("userId");
  const publicTplId = c.req.param("id");
  const publicTpl = await c.env.DB.prepare(
    "SELECT * FROM public_templates WHERE id = ? AND status = ?"
  ).bind(publicTplId, "active").first();
  if (!publicTpl) return fail("public template not found or disabled");
  const id = uuidv7();
  const now = nowISO();
  await c.env.DB.prepare(
    "INSERT INTO sms_templates (id, user_id, name, content, variables_schema, sms_type, status, reviewed_by, reviewed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, publicTpl.name, publicTpl.content, publicTpl.variables_schema, publicTpl.sms_type, "approved", publicTpl.created_by, now, now, now).run();
  return ok({ id, name: publicTpl.name, status: "approved", createdAt: now, adoptedFrom: publicTplId });
});
userTemplates.get("/:id", async (c) => {
  const userId = c.get("userId");
  const tplId = c.req.param("id");
  const tpl = await c.env.DB.prepare(
    "SELECT * FROM sms_templates WHERE id = ? AND user_id = ?"
  ).bind(tplId, userId).first();
  if (!tpl) return fail("template not found");
  return ok(tpl);
});
userTemplates.put("/:id", async (c) => {
  const userId = c.get("userId");
  const tplId = c.req.param("id");
  const body = await c.req.json();
  const tpl = await c.env.DB.prepare(
    "SELECT * FROM sms_templates WHERE id = ? AND user_id = ?"
  ).bind(tplId, userId).first();
  if (!tpl) return fail("template not found");
  const now = nowISO();
  const varsSchema = body.variablesSchema ? JSON.stringify(body.variablesSchema) : null;
  await c.env.DB.prepare(
    "UPDATE sms_templates SET name = ?, content = ?, variables_schema = ?, sms_type = ?, status = ?, reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?"
  ).bind(body.name, body.content, varsSchema, body.smsType || "verification", "pending", now, tplId).run();
  return ok({ id: tplId, status: "pending", updatedAt: now });
});
var user_templates_default = userTemplates;
