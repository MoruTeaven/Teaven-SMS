// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function errorMessage(err) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}
__name(errorMessage, "errorMessage");
async function enqueueSmsOutbox(db, queue, messageId) {
  const row = await db.prepare(
    "SELECT payload, enqueued_at FROM sms_queue_outbox WHERE message_id = ?"
  ).bind(messageId).first();
  if (!row || row.enqueued_at) return false;
  const now = nowISO();
  try {
    await queue.send(JSON.parse(row.payload));
    const result = await db.prepare(`
      UPDATE sms_queue_outbox
      SET enqueued_at = ?, attempts = attempts + 1, last_error = NULL, updated_at = ?
      WHERE message_id = ? AND enqueued_at IS NULL
    `).bind(now, now, messageId).run();
    return result.meta.changes > 0;
  } catch (err) {
    await db.prepare(`
      UPDATE sms_queue_outbox
      SET attempts = attempts + 1, last_error = ?, updated_at = ?
      WHERE message_id = ? AND enqueued_at IS NULL
    `).bind(errorMessage(err), now, messageId).run();
    return false;
  }
}
__name(enqueueSmsOutbox, "enqueueSmsOutbox");
async function drainSmsOutbox(db, queue, limit = 50) {
  const rows = await db.prepare(`
    SELECT message_id
    FROM sms_queue_outbox
    WHERE enqueued_at IS NULL
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(limit).all();
  let enqueued = 0;
  for (const row of rows.results || []) {
    if (await enqueueSmsOutbox(db, queue, row.message_id)) enqueued++;
  }
  return enqueued;
}
__name(drainSmsOutbox, "drainSmsOutbox");
