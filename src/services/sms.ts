// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
async function sendSms(db, queue, params, env) {
  if (params.clientMessageId && params.clientMessageId.length > 128) {
    throw new Error("clientMessageId is too long");
  }
  if (params.clientMessageId) {
    const existing = await db.prepare(
      "SELECT id, status FROM sms_messages WHERE user_id = ? AND client_message_id = ?"
    ).bind(params.userId, params.clientMessageId).first();
    if (existing) {
      return { messageId: existing.id, status: existing.status };
    }
  }
  const user = await db.prepare("SELECT * FROM users WHERE id = ? AND status = ?").bind(params.userId, "active").first();
  if (!user) throw new Error("user not found or disabled");
  const template = await db.prepare(
    "SELECT * FROM sms_templates WHERE id = ? AND user_id = ? AND status = ?"
  ).bind(params.templateId, params.userId, "approved").first();
  if (!template) throw new Error("template not found or not approved");
  const signature = await db.prepare(
    "SELECT * FROM sms_signatures WHERE id = ? AND user_id = ? AND status = ?"
  ).bind(params.signatureId, params.userId, "approved").first();
  if (!signature) throw new Error("signature not found or not approved");
  const countryCode = params.countryCode || "CN";
  const smsType = template.sms_type;
  const route = await selectRoute(
    db,
    params.userId,
    params.signatureId,
    params.templateId,
    countryCode,
    smsType
  );
  if (!route) throw new Error("no available route for this signature and template");
  let userContent = template.content;
  for (const [key, value] of Object.entries(params.variables)) {
    userContent = userContent.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  const messageId = uuidv7();
  const now = nowISO();
  const priceUnits = parseMoneyToUnits(route.channel.cost_price);
  const price = formatMoneyUnits(priceUnits);
  const txnId = uuidv7();
  const job = {
    messageId,
    userId: params.userId,
    signatureId: params.signatureId,
    templateId: params.templateId,
    upstreamSignatureMappingId: route.signatureMapping.id,
    upstreamTemplateMappingId: route.templateMapping.id,
    toNumber: params.toNumber,
    userContent,
    variables: params.variables,
    countryCode
  };
  const chargeResults = await db.batch([
    db.prepare(`
      UPDATE users
      SET balance_units = balance_units - ?,
          balance = printf('%.4f', CAST(balance_units - ? AS REAL) / 10000),
          updated_at = ?
      WHERE id = ? AND status = ? AND balance_units >= ?
    `).bind(priceUnits, priceUnits, now, params.userId, "active", priceUnits),
    db.prepare(`
      INSERT INTO balance_transactions (
        id, user_id, type, amount, balance_after, amount_units, balance_after_units,
        related_message_id, remark, created_at
      )
      SELECT ?, ?, ?, ?, balance, ?, balance_units, ?, ?, ?
      FROM users
      WHERE id = ? AND changes() = 1
    `).bind(txnId, params.userId, "charge", price, priceUnits, messageId, "SMS send charge", now, params.userId),
    db.prepare(`
      INSERT INTO sms_messages (
        id, user_id, channel_id, upstream_id, upstream_message_id, client_message_id,
        signature_id, template_id, upstream_signature_mapping_id, upstream_template_mapping_id,
        upstream_signature_name, upstream_template_id, to_number, user_content, upstream_content,
        status, price, cost_price, price_units, cost_price_units, error_code, error_message,
        retry_count, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE changes() = 1
    `).bind(
      messageId,
      params.userId,
      route.channel.id,
      route.upstreamId,
      null,
      params.clientMessageId || null,
      params.signatureId,
      params.templateId,
      route.signatureMapping.id,
      route.templateMapping.id,
      route.signatureMapping.upstream_signature_name,
      route.templateMapping.upstream_template_id,
      params.toNumber,
      userContent,
      null,
      "queued",
      price,
      price,
      priceUnits,
      priceUnits,
      null,
      null,
      0,
      now
    ),
    db.prepare(`
      INSERT INTO sms_queue_outbox (message_id, payload, created_at, updated_at)
      SELECT ?, ?, ?, ?
      WHERE changes() = 1
    `).bind(messageId, JSON.stringify(job), now, now)
  ]);
  if (chargeResults[0].meta.changes === 0) throw new Error("insufficient balance");
  if (chargeResults[1].meta.changes === 0 || chargeResults[2].meta.changes === 0 || chargeResults[3].meta.changes === 0) {
    throw new Error("failed to create sms charge records");
  }
  await enqueueSmsOutbox(db, queue, messageId);
  if (env) {
    await broadcastMessage(env, {
      type: "message_created",
      message: {
        id: messageId,
        user_id: params.userId,
        to_number: params.toNumber,
        user_content: userContent,
        status: "queued",
        price,
        created_at: now
      }
    });
  }
  return { messageId, status: "queued" };
}
__name(sendSms, "sendSms");
