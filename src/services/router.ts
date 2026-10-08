// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
async function selectRoute(db, userId, signatureId, templateId, countryCode, smsType) {
  const signature = await db.prepare(
    "SELECT * FROM sms_signatures WHERE id = ? AND user_id = ? AND status = ?"
  ).bind(signatureId, userId, "approved").first();
  if (!signature) return null;
  const template = await db.prepare(
    "SELECT * FROM sms_templates WHERE id = ? AND user_id = ? AND status = ?"
  ).bind(templateId, userId, "approved").first();
  if (!template) return null;
  const signatureMappings = await db.prepare(`
    SELECT usm.*, u.code as upstream_code, u.name as upstream_name
    FROM upstream_signature_mappings usm
    JOIN upstreams u ON u.id = usm.upstream_id
    WHERE usm.signature_id = ? AND usm.status = ? AND u.status = 'active'
    ORDER BY usm.priority ASC
  `).bind(signatureId, "approved").all();
  if (!signatureMappings.results || signatureMappings.results.length === 0) return null;
  const templateMappings = await db.prepare(`
    SELECT utm.*, u.code as upstream_code
    FROM upstream_template_mappings utm
    JOIN upstreams u ON u.id = utm.upstream_id
    WHERE utm.template_id = ? AND utm.status = ? AND u.status = 'active'
    ORDER BY utm.priority ASC
  `).bind(templateId, "approved").all();
  if (!templateMappings.results || templateMappings.results.length === 0) return null;
  for (const sigMapping of signatureMappings.results) {
    for (const tplMapping of templateMappings.results) {
      if (sigMapping.upstream_id !== tplMapping.upstream_id) continue;
      const upstreamId = sigMapping.upstream_id;
      const channel = await db.prepare(`
        SELECT * FROM channels
        WHERE upstream_id = ? AND status = ? AND sms_type = ? AND (country_code = ? OR country_code = '*')
        ORDER BY priority ASC
        LIMIT 1
      `).bind(upstreamId, "active", smsType, countryCode).first();
      if (!channel) continue;
      if (sigMapping.channel_id && sigMapping.channel_id !== channel.id) continue;
      if (tplMapping.channel_id && tplMapping.channel_id !== channel.id) continue;
      return {
        channel,
        upstreamId,
        upstreamCode: sigMapping.upstream_code,
        signatureMapping: sigMapping,
        templateMapping: tplMapping
      };
    }
  }
  return null;
}
__name(selectRoute, "selectRoute");
