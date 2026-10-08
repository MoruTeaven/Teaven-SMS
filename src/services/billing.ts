import { uuidv7 } from '../utils/uuid';
import { nowISO } from '../utils/response';

export async function refundBalance(
  db: D1Database,
  userId: string,
  amount: string,
  messageId: string,
  remark = 'auto refund for failed sms',
): Promise<boolean> {
  const refundAmount = parseFloat(amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) return false;

  const amountText = refundAmount.toFixed(4);
  const now = nowISO();
  const txnId = uuidv7();

  const results = await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO balance_transactions (
        id, user_id, type, amount, balance_after, related_message_id, remark, created_at
      )
      SELECT ?, ?, ?, ?, printf('%.4f', CAST(balance AS REAL) + ?), ?, ?, ?
      FROM users
      WHERE id = ?
    `).bind(txnId, userId, 'refund', amountText, refundAmount, messageId, remark, now, userId),
    db.prepare(`
      UPDATE users
      SET balance = printf('%.4f', CAST(balance AS REAL) + ?), updated_at = ?
      WHERE id = ? AND changes() = 1
    `).bind(refundAmount, now, userId),
  ]);

  return ((results[0].meta.changes as number | undefined) || 0) > 0;
}
