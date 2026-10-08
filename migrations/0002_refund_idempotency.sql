-- Ensure a failed SMS can be refunded at most once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_refund_once
ON balance_transactions(related_message_id, type)
WHERE type = 'refund' AND related_message_id IS NOT NULL;
