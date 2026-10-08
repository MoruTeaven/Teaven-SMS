// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminUsers = new Hono2();
adminUsers.use("*", jwtAuth(), requireRole("admin"));
adminUsers.get("/", async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  let where = "WHERE 1=1";
  const params = [];
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (search) {
    where += " AND (id LIKE ? OR email LIKE ? OR nickname LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const count = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...params).first();
  const rows = await c.env.DB.prepare(
    `SELECT id, email, nickname, role, status, balance, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
adminUsers.get("/messages", async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status");
  const toNumber = url.searchParams.get("to");
  let query = `
    SELECT m.*, u.email as user_email, s.name as signature_name, t.name as template_name,
      up.name as upstream_name, ch.name as channel_name
    FROM sms_messages m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN sms_signatures s ON s.id = m.signature_id
    LEFT JOIN sms_templates t ON t.id = m.template_id
    LEFT JOIN upstreams up ON up.id = m.upstream_id
    LEFT JOIN channels ch ON ch.id = m.channel_id
    WHERE 1=1
  `;
  const params = [];
  if (userId) {
    query += " AND m.user_id = ?";
    params.push(userId);
  }
  if (status) {
    query += " AND m.status = ?";
    params.push(status);
  }
  if (toNumber) {
    query += " AND m.to_number = ?";
    params.push(toNumber);
  }
  const countQuery = query.replace(
    `SELECT m.*, u.email as user_email, s.name as signature_name, t.name as template_name,
      up.name as upstream_name, ch.name as channel_name`,
    "SELECT COUNT(*) as total"
  );
  const count = await c.env.DB.prepare(countQuery).bind(...params).first();
  query += " ORDER BY m.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok({ items: rows.results, total: count?.total || 0, page, pageSize });
});
adminUsers.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.email || !body.password) return fail("email and password are required");
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
  if (existing) return fail("email already exists");
  const id = uuidv7();
  const passwordHash = await hashPassword(body.password);
  const now = nowISO();
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, nickname, role, status, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, body.email, passwordHash, body.nickname || null, body.role || "user", "active", "0", now, now).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "user.create",
    targetType: "user",
    targetId: id,
    newValue: { email: body.email, nickname: body.nickname || null, role: body.role || "user" },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id, email: body.email, nickname: body.nickname || null, role: body.role || "user" });
});
adminUsers.patch("/:id", async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  if (!user) return fail("user not found");
  const now = nowISO();
  const status = body.status ?? user.status;
  const role = body.role ?? user.role;
  const nickname = body.nickname !== void 0 ? body.nickname : user.nickname;
  await c.env.DB.prepare("UPDATE users SET status = ?, role = ?, nickname = ?, updated_at = ? WHERE id = ?").bind(status, role, nickname, now, userId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "user.update",
    targetType: "user",
    targetId: userId,
    oldValue: { status: user.status, role: user.role, nickname: user.nickname },
    newValue: { status, role, nickname },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: userId, status, role, nickname });
});
adminUsers.post("/:id/balance", async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json();
  if (!body.amount || !body.type) return fail("amount and type are required");
  let amountUnits;
  try {
    amountUnits = parseMoneyToUnits(body.amount);
  } catch {
    return fail("amount must be a positive number with up to 4 decimal places");
  }
  if (amountUnits <= 0) return fail("amount must be positive");
  const now = nowISO();
  const amountText = formatMoneyUnits(amountUnits);
  const { meta } = await c.env.DB.prepare(`
    UPDATE users
    SET balance_units = balance_units + ?,
        balance = printf('%.4f', CAST(balance_units + ? AS REAL) / 10000),
        updated_at = ?
    WHERE id = ?
  `).bind(amountUnits, amountUnits, now, userId).run();
  if (meta.changes === 0) return fail("user not found");
  const updatedUser = await c.env.DB.prepare("SELECT balance, balance_units FROM users WHERE id = ?").bind(userId).first();
  const newBalanceUnits = Number(updatedUser.balance_units || 0);
  const newBalanceStr = formatMoneyUnits(newBalanceUnits);
  const txnId = uuidv7();
  await c.env.DB.prepare(
    `INSERT INTO balance_transactions (
      id, user_id, type, amount, balance_after, amount_units, balance_after_units, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(txnId, userId, body.type, amountText, newBalanceStr, amountUnits, newBalanceUnits, body.remark || null, now).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "user.balance.adjust",
    targetType: "user",
    targetId: userId,
    newValue: { type: body.type, amount: amountText, balanceAfter: newBalanceStr, remark: body.remark || null },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: userId, balance: newBalanceStr, transactionId: txnId });
});
adminUsers.get("/finance", async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const requestedType = url.searchParams.get("type");
  const search = url.searchParams.get("search");
  let where = "WHERE 1=1";
  const params = [];
  if (requestedType && requestedType !== "all") {
    where += " AND bt.type = ?";
    params.push(requestedType === "deduct" ? "charge" : requestedType);
  }
  if (search) {
    where += " AND (bt.id LIKE ? OR bt.user_id LIKE ? OR u.email LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const count = await c.env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM balance_transactions bt
    LEFT JOIN users u ON u.id = bt.user_id
    ${where}
  `).bind(...params).first();
  const rows = await c.env.DB.prepare(`
    SELECT
      bt.id,
      bt.user_id,
      bt.type,
      bt.amount,
      bt.balance_after,
      bt.related_message_id,
      bt.remark,
      bt.created_at,
      u.email AS user_email
    FROM balance_transactions bt
    LEFT JOIN users u ON u.id = bt.user_id
    ${where}
    ORDER BY bt.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, pageSize, offset).all();
  return ok({
    items: (rows.results || []).map((row) => {
      const amount = Number(row.amount || 0);
      const signedAmount = row.type === "charge" || row.type === "freeze" ? -Math.abs(amount) : amount;
      const balanceAfter = Number(row.balance_after || 0);
      return {
        id: row.id,
        userId: row.user_id,
        userName: row.user_email || row.user_id,
        type: row.type === "charge" ? "deduct" : row.type,
        amount: signedAmount,
        balanceBefore: balanceAfter - signedAmount,
        balanceAfter,
        relatedMsg: row.related_message_id,
        note: row.remark || "",
        time: row.created_at
      };
    }),
    total: count?.total || 0,
    page,
    pageSize
  });
});
adminUsers.get("/:id/api-keys", async (c) => {
  const userId = c.req.param("id");
  const rows = await c.env.DB.prepare(
    "SELECT id, access_key, name, ip_allowlist, status, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return ok(rows.results);
});
adminUsers.post("/:id/impersonate", async (c) => {
  const userId = c.req.param("id");
  const user = await c.env.DB.prepare("SELECT id, email, role, status FROM users WHERE id = ?").bind(userId).first();
  if (!user) return fail("user not found");
  if (user.status !== "active") return fail("account is disabled or suspended");
  const token = await signJwt(c.env.JWT_SECRET, {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1e3) + 86400
  });
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "user.impersonate",
    targetType: "user",
    targetId: userId,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ userId: user.id, role: user.role, email: user.email, token });
});
var admin_users_default = adminUsers;
