// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
async function writeAuditLog(db, params) {
  await db.prepare(`
    INSERT INTO audit_logs (
      id, operator_id, operator_role, action, target_type, target_id,
      old_value, new_value, ip, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uuidv7(),
    params.operatorId,
    params.operatorRole,
    params.action,
    params.targetType || null,
    params.targetId || null,
    params.oldValue === void 0 ? null : JSON.stringify(params.oldValue),
    params.newValue === void 0 ? null : JSON.stringify(params.newValue),
    params.ip || null,
    nowISO()
  ).run();
}
__name(writeAuditLog, "writeAuditLog");
function requestIp(headers) {
  return headers.get("CF-Connecting-IP") || headers.get("X-Real-IP") || null;
}
__name(requestIp, "requestIp");
