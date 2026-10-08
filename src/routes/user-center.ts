// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var userCenter = new Hono2();
userCenter.use("*", jwtAuth());
userCenter.put("/password", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  if (!body.oldPassword || !body.newPassword) {
    return fail("oldPassword and newPassword are required");
  }
  if (body.newPassword.length < 8) {
    return fail("new password must be at least 8 characters");
  }
  const user = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(userId).first();
  if (!user) return fail("user not found");
  const valid = await verifyPassword(body.oldPassword, user.password_hash);
  if (!valid) return fail("current password is incorrect");
  const newHash = await hashPassword(body.newPassword);
  const now = nowISO();
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(newHash, now, userId).run();
  return ok({ updatedAt: now }, "password updated");
});
userCenter.get("/stats", async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare("SELECT balance FROM users WHERE id = ?").bind(userId).first();
  const todayStats = await c.env.DB.prepare(
    `SELECT COUNT(*) as today_sent,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as today_delivered,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as today_failed,
       COALESCE(SUM(price_units), 0) / 10000.0 as today_cost
    FROM sms_messages WHERE user_id = ? AND date(created_at) = date('now')`
  ).bind(userId).first();
  const yesterdayRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM sms_messages WHERE user_id = ? AND date(created_at) = date('now','-1 day')`
  ).bind(userId).first();
  const latencyRow = await c.env.DB.prepare(
    `SELECT AVG((julianday(delivered_at) - julianday(created_at)) * 86400) as avg_latency
     FROM sms_messages WHERE user_id = ? AND status = 'delivered' AND delivered_at IS NOT NULL
     AND date(created_at) = date('now')`
  ).bind(userId).first();
  const weekTrend = await c.env.DB.prepare(
    `SELECT date(created_at) as date, COUNT(*) as sent,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       COALESCE(SUM(price_units), 0) / 10000.0 as cost
     FROM sms_messages WHERE user_id = ? AND created_at >= datetime('now','-7 days')
     GROUP BY date(created_at) ORDER BY date ASC`
  ).bind(userId).all();
  const upstreamDist = await c.env.DB.prepare(
    `SELECT COALESCE(u.name, '\u672A\u77E5') as name, COUNT(*) as count
     FROM sms_messages m LEFT JOIN upstreams u ON m.upstream_id = u.id
     WHERE m.user_id = ? AND date(m.created_at) = date('now')
     GROUP BY m.upstream_id`
  ).bind(userId).all();
  const weekCostRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(price_units), 0) / 10000.0 as week_cost
     FROM sms_messages WHERE user_id = ? AND created_at >= datetime('now','-7 days')`
  ).bind(userId).first();
  const rechargeRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_units), 0) / 10000.0 as total FROM balance_transactions WHERE user_id = ? AND type = 'recharge'`
  ).bind(userId).first();
  const chargeRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_units), 0) / 10000.0 as total FROM balance_transactions WHERE user_id = ? AND type = 'charge'`
  ).bind(userId).first();
  const refundRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_units), 0) / 10000.0 as total FROM balance_transactions WHERE user_id = ? AND type = 'refund'`
  ).bind(userId).first();
  const todaySent = todayStats?.today_sent || 0;
  const todayDelivered = todayStats?.today_delivered || 0;
  const todayCost = todayStats?.today_cost || 0;
  const ySent = yesterdayRow?.cnt || 0;
  const successRate = todaySent > 0 ? +(todayDelivered / todaySent * 100).toFixed(2) : 0;
  const todaySentTrend = ySent > 0 ? +((todaySent - ySent) / ySent * 100).toFixed(1) : 0;
  return ok({
    balance: user?.balance || "0",
    todaySent,
    todayDelivered,
    todayFailed: todayStats?.today_failed || 0,
    todayCost,
    successRate,
    todaySentTrend,
    avgLatency: latencyRow?.avg_latency ? +latencyRow.avg_latency.toFixed(2) : 0,
    weekTrend: weekTrend.results,
    upstreamDist: upstreamDist.results,
    weekCost: weekCostRow?.week_cost || 0,
    totalRecharge: rechargeRow?.total || 0,
    totalCharge: chargeRow?.total || 0,
    totalRefund: refundRow?.total || 0
  });
});
userCenter.get("/messages", async (c) => {
  const userId = c.get("userId");
  const { page, pageSize, offset } = parsePagination(c.req.url);
  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const to = url.searchParams.get("to");
  let where = "WHERE m.user_id = ?";
  const params = [userId];
  if (status) {
    where += " AND m.status = ?";
    params.push(status);
  }
  if (to) {
    where += " AND m.to_number = ?";
    params.push(to);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM sms_messages m ${where}`
  ).bind(...params).first();
  const rows = await c.env.DB.prepare(
    `SELECT m.*, s.name as signature_name, t.name as template_name, t.sms_type as template_type
     FROM sms_messages m
     LEFT JOIN sms_signatures s ON m.signature_id = s.id
     LEFT JOIN sms_templates t ON m.template_id = t.id
     ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
userCenter.get("/transactions", async (c) => {
  const userId = c.get("userId");
  const { page, pageSize, offset } = parsePagination(c.req.url);
  const url = new URL(c.req.url);
  const type = url.searchParams.get("type");
  let where = "WHERE user_id = ?";
  const params = [userId];
  if (type && type !== "all") {
    where += " AND type = ?";
    params.push(type);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM balance_transactions ${where}`
  ).bind(...params).first();
  const rows = await c.env.DB.prepare(
    `SELECT * FROM balance_transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
userCenter.post("/sms/send", async (c) => {
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
      variables: body.variables || {}
    }, c.env);
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "send failed");
  }
});
userCenter.post("/recharge", async () => {
  return fail("self-service recharge is disabled until payment verification is implemented", 403, 403);
});
var user_center_default = userCenter;
