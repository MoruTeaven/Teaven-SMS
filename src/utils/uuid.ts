// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var counter = 0;
function uuidv7() {
  const now = Date.now();
  const timestamp = BigInt(now);
  const timeHigh = Number(timestamp >> 16n & 0xFFFFFFFFn);
  const timeLow = Number(timestamp & 0xFFFFn);
  counter = counter + 1 & 4095;
  const randA = counter | 28672;
  const randB = new Uint8Array(8);
  crypto.getRandomValues(randB);
  const parts = [
    timeHigh.toString(16).padStart(8, "0"),
    timeLow.toString(16).padStart(4, "0"),
    randA.toString(16).padStart(4, "0"),
    (randB[0] & 63 | 128).toString(16).padStart(2, "0") + randB[1].toString(16).padStart(2, "0"),
    randB[2].toString(16).padStart(2, "0") + randB[3].toString(16).padStart(2, "0") + randB[4].toString(16).padStart(2, "0") + randB[5].toString(16).padStart(2, "0") + randB[6].toString(16).padStart(2, "0") + randB[7].toString(16).padStart(2, "0")
  ];
  return parts.join("-");
}
__name(uuidv7, "uuidv7");
function generateAccessKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "ak_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateAccessKey, "generateAccessKey");
function generateSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "sk_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateSecret, "generateSecret");
