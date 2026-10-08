// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminPublicTemplates = new Hono2();
adminPublicTemplates.use("*", jwtAuth(), requireRole("admin"));
adminPublicTemplates.get("/", async (c) => {
  const { page, pageSize, offset } = parsePagination(c.req.url);
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const smsType = url.searchParams.get("smsType");
  let where = "WHERE 1=1";
  const params = [];
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (smsType) {
    where += " AND sms_type = ?";
    params.push(smsType);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM public_templates ${where}`
  ).bind(...params).first();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM public_templates ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
adminPublicTemplates.get("/:id", async (c) => {
  const id = c.req.param("id");
  const tpl = await c.env.DB.prepare(
    "SELECT * FROM public_templates WHERE id = ?"
  ).bind(id).first();
  if (!tpl) return fail("template not found");
  return ok(tpl);
});
adminPublicTemplates.post("/", async (c) => {
  const adminId = c.get("userId");
  const body = await c.req.json();
  if (!body.name || !body.content) {
    return fail("name and content are required");
  }
  const id = uuidv7();
  const now = nowISO();
  const varsSchema = body.variablesSchema ? JSON.stringify(body.variablesSchema) : null;
  const status = body.status || "active";
  await c.env.DB.prepare(
    "INSERT INTO public_templates (id, name, content, variables_schema, sms_type, status, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, body.name, body.content, varsSchema, body.smsType || "verification", status, body.description || null, adminId, now, now).run();
  return ok({ id, name: body.name, status, createdAt: now });
});
adminPublicTemplates.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const tpl = await c.env.DB.prepare(
    "SELECT * FROM public_templates WHERE id = ?"
  ).bind(id).first();
  if (!tpl) return fail("template not found");
  const now = nowISO();
  const name = body.name || tpl.name;
  const content = body.content || tpl.content;
  const varsSchema = body.variablesSchema ? JSON.stringify(body.variablesSchema) : tpl.variables_schema;
  const smsType = body.smsType || tpl.sms_type;
  const status = body.status || tpl.status;
  const description = body.description !== void 0 ? body.description : tpl.description;
  await c.env.DB.prepare(
    "UPDATE public_templates SET name = ?, content = ?, variables_schema = ?, sms_type = ?, status = ?, description = ?, updated_at = ? WHERE id = ?"
  ).bind(name, content, varsSchema, smsType, status, description, now, id).run();
  return ok({ id, status, updatedAt: now });
});
adminPublicTemplates.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const tpl = await c.env.DB.prepare(
    "SELECT * FROM public_templates WHERE id = ?"
  ).bind(id).first();
  if (!tpl) return fail("template not found");
  await c.env.DB.prepare("DELETE FROM public_templates WHERE id = ?").bind(id).run();
  return ok({ id, deleted: true });
});
var admin_public_templates_default = adminPublicTemplates;
