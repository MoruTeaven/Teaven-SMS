// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminMappings = new Hono2();
adminMappings.use("*", jwtAuth(), requireRole("admin"));
adminMappings.get("/", async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const count = await c.env.DB.prepare(`
    SELECT SUM(total) AS total FROM (
      SELECT COUNT(*) AS total FROM upstream_signature_mappings
      UNION ALL
      SELECT COUNT(*) AS total FROM upstream_template_mappings
    )
  `).first();
  const rows = await c.env.DB.prepare(`
    SELECT * FROM (
      SELECT
        id,
        'signature' AS mapping_type,
        signature_id,
        NULL AS template_id,
        upstream_id,
        channel_id,
        upstream_signature_id,
        upstream_signature_name,
        NULL AS upstream_template_id,
        NULL AS upstream_template_content,
        NULL AS variable_mapping,
        priority,
        status,
        created_at,
        updated_at
      FROM upstream_signature_mappings
      UNION ALL
      SELECT
        id,
        'template' AS mapping_type,
        NULL AS signature_id,
        template_id,
        upstream_id,
        channel_id,
        NULL AS upstream_signature_id,
        NULL AS upstream_signature_name,
        upstream_template_id,
        upstream_template_content,
        variable_mapping,
        priority,
        status,
        created_at,
        updated_at
      FROM upstream_template_mappings
    )
    ORDER BY priority ASC, created_at DESC
    LIMIT ? OFFSET ?
  `).bind(pageSize, offset).all();
  return ok({ items: rows.results || [], total: count?.total || 0, page, pageSize });
});
adminMappings.post("/signatures", async (c) => {
  const adminId = c.get("userId");
  const body = await c.req.json();
  if (!body.signatureId || !body.upstreamId || !body.upstreamSignatureName) {
    return fail("signatureId, upstreamId, and upstreamSignatureName are required");
  }
  const sig = await c.env.DB.prepare("SELECT id FROM sms_signatures WHERE id = ?").bind(body.signatureId).first();
  if (!sig) return fail("signature not found");
  const upstream = await c.env.DB.prepare("SELECT id FROM upstreams WHERE id = ?").bind(body.upstreamId).first();
  if (!upstream) return fail("upstream not found");
  const id = uuidv7();
  const now = nowISO();
  await c.env.DB.prepare(`
    INSERT INTO upstream_signature_mappings (
      id, signature_id, upstream_id, channel_id, upstream_signature_id,
      upstream_signature_name, priority, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.signatureId,
    body.upstreamId,
    body.channelId || null,
    body.upstreamSignatureId || null,
    body.upstreamSignatureName,
    body.priority || 100,
    body.status || "approved",
    adminId,
    now,
    now
  ).run();
  await writeAuditLog(c.env.DB, {
    operatorId: adminId,
    operatorRole: c.get("userRole"),
    action: "mapping.signature.create",
    targetType: "upstream_signature_mapping",
    targetId: id,
    newValue: body,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id, signatureId: body.signatureId, upstreamId: body.upstreamId });
});
adminMappings.get("/signatures", async (c) => {
  const url = new URL(c.req.url);
  const signatureId = url.searchParams.get("signatureId");
  const upstreamId = url.searchParams.get("upstreamId");
  let query = "SELECT * FROM upstream_signature_mappings WHERE 1=1";
  const params = [];
  if (signatureId) {
    query += " AND signature_id = ?";
    params.push(signatureId);
  }
  if (upstreamId) {
    query += " AND upstream_id = ?";
    params.push(upstreamId);
  }
  query += " ORDER BY priority ASC, created_at DESC";
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok(rows.results);
});
adminMappings.put("/signatures/:id", async (c) => {
  const mappingId = c.req.param("id");
  const body = await c.req.json();
  const mapping = await c.env.DB.prepare("SELECT * FROM upstream_signature_mappings WHERE id = ?").bind(mappingId).first();
  if (!mapping) return fail("mapping not found");
  const now = nowISO();
  await c.env.DB.prepare(`
    UPDATE upstream_signature_mappings SET
      upstream_signature_name = ?,
      upstream_signature_id = ?,
      channel_id = ?,
      priority = ?,
      status = ?,
      reject_reason = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    body.upstreamSignatureName || mapping.upstream_signature_name,
    body.upstreamSignatureId !== void 0 ? body.upstreamSignatureId : mapping.upstream_signature_id,
    body.channelId !== void 0 ? body.channelId : mapping.channel_id,
    body.priority !== void 0 ? body.priority : mapping.priority,
    body.status || mapping.status,
    body.rejectReason || mapping.reject_reason,
    now,
    mappingId
  ).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "mapping.signature.update",
    targetType: "upstream_signature_mapping",
    targetId: mappingId,
    oldValue: mapping,
    newValue: body,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: mappingId, updatedAt: now });
});
adminMappings.delete("/signatures/:id", async (c) => {
  const mappingId = c.req.param("id");
  const mapping = await c.env.DB.prepare("SELECT * FROM upstream_signature_mappings WHERE id = ?").bind(mappingId).first();
  await c.env.DB.prepare("DELETE FROM upstream_signature_mappings WHERE id = ?").bind(mappingId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "mapping.signature.delete",
    targetType: "upstream_signature_mapping",
    targetId: mappingId,
    oldValue: mapping,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: mappingId }, "mapping deleted");
});
adminMappings.post("/templates", async (c) => {
  const adminId = c.get("userId");
  const body = await c.req.json();
  if (!body.templateId || !body.upstreamId) {
    return fail("templateId and upstreamId are required");
  }
  const tpl = await c.env.DB.prepare("SELECT id FROM sms_templates WHERE id = ?").bind(body.templateId).first();
  if (!tpl) return fail("template not found");
  const upstream = await c.env.DB.prepare("SELECT id FROM upstreams WHERE id = ?").bind(body.upstreamId).first();
  if (!upstream) return fail("upstream not found");
  const id = uuidv7();
  const now = nowISO();
  const varMapping = body.variableMapping ? JSON.stringify(body.variableMapping) : null;
  await c.env.DB.prepare(`
    INSERT INTO upstream_template_mappings (
      id, template_id, upstream_id, channel_id, upstream_template_id,
      upstream_template_content, variable_mapping, priority, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.templateId,
    body.upstreamId,
    body.channelId || null,
    body.upstreamTemplateId || null,
    body.upstreamTemplateContent || null,
    varMapping,
    body.priority || 100,
    body.status || "approved",
    adminId,
    now,
    now
  ).run();
  await writeAuditLog(c.env.DB, {
    operatorId: adminId,
    operatorRole: c.get("userRole"),
    action: "mapping.template.create",
    targetType: "upstream_template_mapping",
    targetId: id,
    newValue: body,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id, templateId: body.templateId, upstreamId: body.upstreamId });
});
adminMappings.get("/templates", async (c) => {
  const url = new URL(c.req.url);
  const templateId = url.searchParams.get("templateId");
  const upstreamId = url.searchParams.get("upstreamId");
  let query = "SELECT * FROM upstream_template_mappings WHERE 1=1";
  const params = [];
  if (templateId) {
    query += " AND template_id = ?";
    params.push(templateId);
  }
  if (upstreamId) {
    query += " AND upstream_id = ?";
    params.push(upstreamId);
  }
  query += " ORDER BY priority ASC, created_at DESC";
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return ok(rows.results);
});
adminMappings.put("/templates/:id", async (c) => {
  const mappingId = c.req.param("id");
  const body = await c.req.json();
  const mapping = await c.env.DB.prepare("SELECT * FROM upstream_template_mappings WHERE id = ?").bind(mappingId).first();
  if (!mapping) return fail("mapping not found");
  const now = nowISO();
  const varMapping = body.variableMapping ? JSON.stringify(body.variableMapping) : mapping.variable_mapping;
  await c.env.DB.prepare(`
    UPDATE upstream_template_mappings SET
      upstream_template_id = ?,
      upstream_template_content = ?,
      variable_mapping = ?,
      channel_id = ?,
      priority = ?,
      status = ?,
      reject_reason = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(
    body.upstreamTemplateId !== void 0 ? body.upstreamTemplateId : mapping.upstream_template_id,
    body.upstreamTemplateContent !== void 0 ? body.upstreamTemplateContent : mapping.upstream_template_content,
    varMapping,
    body.channelId !== void 0 ? body.channelId : mapping.channel_id,
    body.priority !== void 0 ? body.priority : mapping.priority,
    body.status || mapping.status,
    body.rejectReason || mapping.reject_reason,
    now,
    mappingId
  ).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "mapping.template.update",
    targetType: "upstream_template_mapping",
    targetId: mappingId,
    oldValue: mapping,
    newValue: body,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: mappingId, updatedAt: now });
});
adminMappings.delete("/templates/:id", async (c) => {
  const mappingId = c.req.param("id");
  const mapping = await c.env.DB.prepare("SELECT * FROM upstream_template_mappings WHERE id = ?").bind(mappingId).first();
  await c.env.DB.prepare("DELETE FROM upstream_template_mappings WHERE id = ?").bind(mappingId).run();
  await writeAuditLog(c.env.DB, {
    operatorId: c.get("userId"),
    operatorRole: c.get("userRole"),
    action: "mapping.template.delete",
    targetType: "upstream_template_mapping",
    targetId: mappingId,
    oldValue: mapping,
    ip: requestIp(c.req.raw.headers)
  });
  return ok({ id: mappingId }, "mapping deleted");
});
var admin_mappings_default = adminMappings;
