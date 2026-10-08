// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var MONEY_SCALE = 1e4;
function parseMoneyToUnits(value) {
  const text = String(value).trim();
  const match2 = text.match(/^(\d+)(?:\.(\d{0,4}))?$/);
  if (!match2) throw new Error("invalid money amount");
  const whole = Number(match2[1]);
  const fraction = Number((match2[2] || "").padEnd(4, "0"));
  const units = whole * MONEY_SCALE + fraction;
  if (!Number.isSafeInteger(units)) throw new Error("money amount is too large");
  return units;
}
__name(parseMoneyToUnits, "parseMoneyToUnits");
function formatMoneyUnits(units) {
  if (!Number.isSafeInteger(units)) throw new Error("invalid money units");
  const sign = units < 0 ? "-" : "";
  const abs = Math.abs(units);
  const whole = Math.floor(abs / MONEY_SCALE);
  const fraction = String(abs % MONEY_SCALE).padStart(4, "0");
  return `${sign}${whole}.${fraction}`;
}
__name(formatMoneyUnits, "formatMoneyUnits");
