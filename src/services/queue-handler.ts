// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
async function handleSendQueue(batch, env) {
  const registry = new AdapterRegistry();
  for (const message of batch.messages) {
    const job = message.body;
    try {
      const smsRecord = await env.DB.prepare("SELECT * FROM sms_messages WHERE id = ?").bind(job.messageId).first();
      if (!smsRecord) {
        message.ack();
        continue;
      }
      if (smsRecord.status !== "queued") {
        message.ack();
        continue;
      }
      if (!await acquireSendLock(env.DB, job.messageId)) {
        message.retry();
        continue;
      }
      const upstream = await env.DB.prepare("SELECT * FROM upstreams WHERE id = ?").bind(smsRecord.upstream_id).first();
      if (!upstream) {
        if (await markFailed(env.DB, job.messageId, "UPSTREAM_NOT_FOUND", "upstream not found")) {
          await refundBalance(env.DB, smsRecord.user_id, smsRecord.price, job.messageId);
        }
        await releaseSendLock(env.DB, job.messageId);
        message.ack();
        continue;
      }
      let adapter = registry.get(upstream.code);
      if (!adapter) {
        const configJson = await decryptText(env.CONFIG_ENCRYPTION_KEY, upstream.config_encrypted);
        registry.loadFromConfig(upstream.code, upstream.adapter_type, configJson);
        adapter = registry.get(upstream.code);
      }
      if (!adapter) {
        if (await markFailed(env.DB, job.messageId, "ADAPTER_NOT_FOUND", "adapter not found")) {
          await refundBalance(env.DB, smsRecord.user_id, smsRecord.price, job.messageId);
        }
        await releaseSendLock(env.DB, job.messageId);
        message.ack();
        continue;
      }
      const templateMapping = await env.DB.prepare(
        "SELECT * FROM upstream_template_mappings WHERE id = ?"
      ).bind(job.upstreamTemplateMappingId).first();
      const signatureMapping = await env.DB.prepare(
        "SELECT * FROM upstream_signature_mappings WHERE id = ?"
      ).bind(job.upstreamSignatureMappingId).first();
      let upstreamContent = job.userContent;
      if (templateMapping?.upstream_template_content) {
        upstreamContent = templateMapping.upstream_template_content;
        for (const [key, value] of Object.entries(job.variables)) {
          upstreamContent = upstreamContent.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        }
      }
      const result = await adapter.send({
        to: job.toNumber,
        content: upstreamContent,
        signature: signatureMapping?.upstream_signature_name || "",
        templateId: templateMapping?.upstream_template_id || void 0,
        variables: job.variables,
        callbackUrl: `${env.API_BASE_URL}/webhooks/upstreams/${upstream.code}`,
        countryCode: job.countryCode
      });
      const now = nowISO();
      if (result.success) {
        await env.DB.prepare(`
          UPDATE sms_messages SET
            status = ?, upstream_message_id = ?, upstream_content = ?, submitted_at = ?, upstream_id = ?
          WHERE id = ? AND status = 'queued'
        `).bind(
          "submitted",
          result.upstreamMessageId || null,
          upstreamContent,
          now,
          smsRecord.upstream_id,
          job.messageId
        ).run();
        await broadcastMessage(env, {
          type: "message_updated",
          message: {
            id: job.messageId,
            status: "submitted",
            upstream_message_id: result.upstreamMessageId || null,
            upstream_content: upstreamContent,
            submitted_at: now
          }
        });
      } else {
        const failedResult = await env.DB.prepare(`
          UPDATE sms_messages SET
            status = ?, error_code = ?, error_message = ?, upstream_content = ?
          WHERE id = ? AND status = 'queued'
        `).bind(
          "failed",
          result.errorCode || "UPSTREAM_ERROR",
          result.errorMessage || "upstream rejected",
          upstreamContent,
          job.messageId
        ).run();
        if (failedResult.meta.changes > 0) {
          await refundBalance(env.DB, smsRecord.user_id, smsRecord.price, job.messageId);
        }
        await broadcastMessage(env, {
          type: "message_updated",
          message: {
            id: job.messageId,
            status: "failed",
            error_code: result.errorCode || "UPSTREAM_ERROR",
            error_message: result.errorMessage || "upstream rejected"
          }
        });
      }
      await releaseSendLock(env.DB, job.messageId);
      message.ack();
    } catch (err) {
      console.error("send queue error:", err);
      const attempts = message.attempts || 1;
      if (attempts >= 3) {
        const marked = await markFailed(env.DB, job.messageId, "MAX_RETRIES", "max retries exceeded");
        const smsRecord = await env.DB.prepare("SELECT user_id, price FROM sms_messages WHERE id = ?").bind(job.messageId).first();
        if (marked && smsRecord) {
          await refundBalance(env.DB, smsRecord.user_id, smsRecord.price, job.messageId);
        }
        await releaseSendLock(env.DB, job.messageId);
        message.ack();
      } else {
        message.retry();
      }
    }
  }
}
__name(handleSendQueue, "handleSendQueue");
function normalizePhone(value) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.replace(/^\+?86(?=1\d{10}$)/, "");
}
__name(normalizePhone, "normalizePhone");
async function handleReceiptQueue(batch, env) {
  const registry = new AdapterRegistry();
  for (const message of batch.messages) {
    const job = message.body;
    try {
      const upstream = await env.DB.prepare("SELECT * FROM upstreams WHERE code = ?").bind(job.upstreamCode).first();
      if (!upstream) {
        message.ack();
        continue;
      }
      let adapter = registry.get(job.upstreamCode);
      if (!adapter) {
        const configJson = await decryptText(env.CONFIG_ENCRYPTION_KEY, upstream.config_encrypted);
        registry.loadFromConfig(job.upstreamCode, upstream.adapter_type, configJson);
        adapter = registry.get(job.upstreamCode);
      }
      if (!adapter) {
        message.ack();
        continue;
      }
      const receipt = adapter.parseReceipt(job.payload);
      if (!receipt.upstreamMessageId) {
        message.ack();
        continue;
      }
      const sms2 = await env.DB.prepare(
        "SELECT * FROM sms_messages WHERE upstream_message_id = ? AND upstream_id = ?"
      ).bind(receipt.upstreamMessageId, upstream.id).first();
      if (!sms2) {
        message.ack();
        continue;
      }
      if (receipt.toNumber && normalizePhone(receipt.toNumber) !== normalizePhone(sms2.to_number)) {
        message.ack();
        continue;
      }
      const now = nowISO();
      const updates = {
        status: receipt.status
      };
      if (receipt.status === "delivered") {
        updates.delivered_at = now;
      }
      if (receipt.errorCode) {
        updates.error_code = receipt.errorCode;
      }
      if (receipt.errorMessage) {
        updates.error_message = receipt.errorMessage;
      }
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
      const values = [...Object.values(updates), sms2.id];
      const statusGuard = receipt.status === "failed" ? " AND status NOT IN ('delivered', 'failed', 'rejected')" : receipt.status === "delivered" ? " AND status NOT IN ('failed', 'rejected')" : " AND status NOT IN ('delivered', 'failed', 'rejected')";
      const updateResult = await env.DB.prepare(`UPDATE sms_messages SET ${setClauses} WHERE id = ?${statusGuard}`).bind(...values).run();
      if (receipt.status === "failed" && updateResult.meta.changes > 0) {
        await refundBalance(env.DB, sms2.user_id, sms2.price, sms2.id);
      }
      await broadcastMessage(env, {
        type: "message_updated",
        message: {
          id: sms2.id,
          status: receipt.status,
          delivered_at: receipt.status === "delivered" ? now : void 0,
          error_code: receipt.errorCode || void 0,
          error_message: receipt.errorMessage || void 0
        }
      });
      message.ack();
    } catch (err) {
      console.error("receipt queue error:", err);
      message.ack();
    }
  }
}
__name(handleReceiptQueue, "handleReceiptQueue");
async function acquireSendLock(db, messageId) {
  const now = nowISO();
  const leaseExpiresAt = new Date(Date.now() + 6e4).toISOString();
  await db.prepare("DELETE FROM sms_send_locks WHERE message_id = ? AND lease_expires_at < ?").bind(messageId, now).run();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO sms_send_locks (message_id, lease_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(messageId, leaseExpiresAt, now, now).run();
  return result.meta.changes > 0;
}
__name(acquireSendLock, "acquireSendLock");
async function releaseSendLock(db, messageId) {
  await db.prepare("DELETE FROM sms_send_locks WHERE message_id = ?").bind(messageId).run();
}
__name(releaseSendLock, "releaseSendLock");
async function markFailed(db, messageId, errorCode, errorMessage2) {
  const result = await db.prepare(
    "UPDATE sms_messages SET status = ?, error_code = ?, error_message = ? WHERE id = ? AND status NOT IN ('delivered', 'failed', 'rejected')"
  ).bind("failed", errorCode, errorMessage2, messageId).run();
  return result.meta.changes > 0;
}
__name(markFailed, "markFailed");
