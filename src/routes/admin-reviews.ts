// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminReviews = new Hono2();
adminReviews.use("*", jwtAuth(), requireRole("admin"));
adminReviews.get("/signatures", async (c) => {
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  let query = "SELECT s.*, u.email as user_email FROM sms_signatures s JOIN users u ON u.id = s.user_id";
  const params = [];
  if (status) {
    query += " WHERE s.status = ?";
    params.push(status);
  }
  const countQuery = query.replace("SELECT s.*, u.email as user_email", "SELECT COUNT(*) as total");
  const count = await c.env.DB.prepare(countQuery).bind(...params).first();
  query += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
adminReviews.patch("/signatures/:id", async (c) => {
  const sigId = c.req.param("id");
  const adminId = c.get("userId");
  const body = await c.req.json();
  if (!body.action) return fail("action is required");
  if (body.action === "reject" && !body.rejectReason) return fail("rejectReason is required");
  const sig = await c.env.DB.prepare("SELECT * FROM sms_signatures WHERE id = ?").bind(sigId).first();
  if (!sig) return fail("signature not found");
  const now = nowISO();
  const status = body.action === "approve" ? "approved" : "rejected";
  await c.env.DB.prepare(
    "UPDATE sms_signatures SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?"
  ).bind(status, body.rejectReason || null, adminId, now, now, sigId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: adminId,
    operatorRole: c.get("userRole"),
    action: "review.signature",
    targetType: "sms_signature",
    targetId: sigId,
    oldValue: sig,
    newValue: { status, rejectReason: body.rejectReason || null },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: sigId, status, reviewedAt: now });
});
adminReviews.get("/templates", async (c) => {
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  let query = "SELECT t.*, u.email as user_email FROM sms_templates t JOIN users u ON u.id = t.user_id";
  const params = [];
  if (status) {
    query += " WHERE t.status = ?";
    params.push(status);
  }
  const countQuery = query.replace("SELECT t.*, u.email as user_email", "SELECT COUNT(*) as total");
  const count = await c.env.DB.prepare(countQuery).bind(...params).first();
  query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
adminReviews.patch("/templates/:id", async (c) => {
  const tplId = c.req.param("id");
  const adminId = c.get("userId");
  const body = await c.req.json();
  if (!body.action) return fail("action is required");
  if (body.action === "reject" && !body.rejectReason) return fail("rejectReason is required");
  const tpl = await c.env.DB.prepare("SELECT * FROM sms_templates WHERE id = ?").bind(tplId).first();
  if (!tpl) return fail("template not found");
  const now = nowISO();
  const status = body.action === "approve" ? "approved" : "rejected";
  await c.env.DB.prepare(
    "UPDATE sms_templates SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?"
  ).bind(status, body.rejectReason || null, adminId, now, now, tplId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: adminId,
    operatorRole: c.get("userRole"),
    action: "review.template",
    targetType: "sms_template",
    targetId: tplId,
    oldValue: tpl,
    newValue: { status, rejectReason: body.rejectReason || null },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: tplId, status, reviewedAt: now });
});
var admin_reviews_default = adminReviews;
