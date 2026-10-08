// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var sms = new Hono2();
sms.use("*", apiKeyAuth());
sms.post("/send", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.to || !body.signatureId || !body.templateId) {
    return fail("to, signatureId, and templateId are required");
  }
  try {
    const result = await sendSms(c.env.DB, c.env.SMS_SEND_QUEUE, {
      userId,
      signatureId: body.signatureId,
      templateId: body.templateId,
      toNumber: body.to,
      variables: body.variables || {},
      countryCode: body.countryCode,
      clientMessageId: body.clientMessageId
    }, c.env);
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "send failed");
  }
});
sms.post("/batch-send", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return fail("items array is required");
  }
  if (body.items.length > 100) {
    return fail("max 100 items per batch");
  }
  const results = [];
  for (const item of body.items) {
    try {
      const result = await sendSms(c.env.DB, c.env.SMS_SEND_QUEUE, {
        userId,
        signatureId: item.signatureId,
        templateId: item.templateId,
        toNumber: item.to,
        variables: item.variables || {},
        clientMessageId: item.clientMessageId
      }, c.env);
      results.push({ to: item.to, ...result });
    } catch (err) {
      results.push({
        to: item.to,
        messageId: null,
        status: "failed",
        error: err instanceof Error ? err.message : "send failed"
      });
    }
  }
  return ok(results);
});
sms.get("/messages/:id", async (c) => {
  const userId = c.get("userId");
  const messageId = c.req.param("id");
  const message = await c.env.DB.prepare(
    "SELECT * FROM sms_messages WHERE id = ? AND user_id = ?"
  ).bind(messageId, userId).first();
  if (!message) {
    return fail("message not found");
  }
  return ok(message);
});
sms.get("/messages", async (c) => {
  const userId = c.get("userId");
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const status = url.searchParams.get("status");
  const toNumber = url.searchParams.get("to");
  let query = "SELECT * FROM sms_messages WHERE user_id = ?";
  const params = [userId];
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (toNumber) {
    query += " AND to_number = ?";
    params.push(toNumber);
  }
  const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
  const count = await c.env.DB.prepare(countQuery).bind(...params).first();
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok({
    items: rows.results,
    total: count?.total || 0,
    page,
    pageSize
  });
});
var sms_default = sms;
