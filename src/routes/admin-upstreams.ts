// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminUpstreams = new Hono2();
adminUpstreams.use("*", jwtAuth(), requireRole("admin"));
adminUpstreams.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.code || !body.name || !body.adapterType || !body.config) {
    return fail("code, name, adapterType, and config are required");
  }
  const existing = await c.env.DB.prepare("SELECT id FROM upstreams WHERE code = ?").bind(body.code).first();
  if (existing) return fail("upstream code already exists");
  const id = uuidv7();
  const now = nowISO();
  const configEncrypted = await encryptText(c.env.CONFIG_ENCRYPTION_KEY, JSON.stringify(body.config));
  await c.env.DB.prepare(
    "INSERT INTO upstreams (id, code, name, adapter_type, config_encrypted, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, body.code, body.name, body.adapterType, configEncrypted, "active", now, now).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "upstream.create",
    targetType: "upstream",
    targetId: id,
    newValue: { code: body.code, name: body.name, adapterType: body.adapterType, status: "active" },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id, code: body.code, name: body.name, status: "active" });
});
adminUpstreams.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, code, name, adapter_type, status, created_at, updated_at FROM upstreams ORDER BY created_at DESC"
  ).all();
  return ok(rows.results);
});
adminUpstreams.get("/:id", async (c) => {
  const upstream = await c.env.DB.prepare(
    "SELECT id, code, name, adapter_type, status, created_at, updated_at FROM upstreams WHERE id = ?"
  ).bind(c.req.param("id")).first();
  if (!upstream) return fail("upstream not found");
  return ok({ ...upstream, configConfigured: true });
});
adminUpstreams.put("/:id", async (c) => {
  const upstreamId = c.req.param("id");
  const body = await c.req.json();
  const upstream = await c.env.DB.prepare("SELECT * FROM upstreams WHERE id = ?").bind(upstreamId).first();
  if (!upstream) return fail("upstream not found");
  const now = nowISO();
  const name = body.name || upstream.name;
  const adapterType = body.adapterType || upstream.adapter_type;
  const configEncrypted = body.config !== void 0 ? await encryptText(c.env.CONFIG_ENCRYPTION_KEY, JSON.stringify(body.config)) : upstream.config_encrypted;
  const status = body.status || upstream.status;
  await c.env.DB.prepare(
    "UPDATE upstreams SET name = ?, adapter_type = ?, config_encrypted = ?, status = ?, updated_at = ? WHERE id = ?"
  ).bind(name, adapterType, configEncrypted, status, now, upstreamId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "upstream.update",
    targetType: "upstream",
    targetId: upstreamId,
    oldValue: { name: upstream.name, adapterType: upstream.adapter_type, status: upstream.status },
    newValue: { name, adapterType, status, configUpdated: body.config !== void 0 },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: upstreamId, updatedAt: now });
});
adminUpstreams.post("/:id/channels", async (c) => {
  const upstreamId = c.req.param("id");
  const body = await c.req.json();
  if (!body.name) return fail("name is required");
  const upstream = await c.env.DB.prepare("SELECT id FROM upstreams WHERE id = ?").bind(upstreamId).first();
  if (!upstream) return fail("upstream not found");
  const id = uuidv7();
  const now = nowISO();
  let costPriceUnits;
  try {
    costPriceUnits = parseMoneyToUnits(body.costPrice || "0");
  } catch {
    return fail("costPrice must be a non-negative number with up to 4 decimal places");
  }
  const costPrice = formatMoneyUnits(costPriceUnits);
  await c.env.DB.prepare(
    `INSERT INTO channels (
      id, upstream_id, name, country_code, sms_type, cost_price, cost_price_units,
      priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    upstreamId,
    body.name,
    body.countryCode || "*",
    body.smsType || "transactional",
    costPrice,
    costPriceUnits,
    body.priority || 100,
    "active",
    now,
    now
  ).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "channel.create",
    targetType: "channel",
    targetId: id,
    newValue: { upstreamId, name: body.name, countryCode: body.countryCode || "*", smsType: body.smsType || "transactional", costPrice },
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id, upstreamId, name: body.name });
});
adminUpstreams.get("/:id/channels", async (c) => {
  const upstreamId = c.req.param("id");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM channels WHERE upstream_id = ? ORDER BY priority ASC"
  ).bind(upstreamId).all();
  return ok(rows.results);
});
var admin_upstreams_default = adminUpstreams;
