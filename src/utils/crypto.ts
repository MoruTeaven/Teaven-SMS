// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var PBKDF2_ITERATIONS = 77777;
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
function hexToBytes(hex) {
  const matches = hex.match(/.{2}/g);
  if (!matches || matches.join("") !== hex) {
    throw new Error("invalid hex string");
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}
__name(hexToBytes, "hexToBytes");
async function deriveAesKey(secret) {
  const encoder = new TextEncoder();
  const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(deriveAesKey, "deriveAesKey");
async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const saltHex = bytesToHex(salt);
  const hashHex = bytesToHex(new Uint8Array(hash));
  return `${saltHex}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  const [saltHex, expectedHashHex] = stored.split(":");
  if (!saltHex || !expectedHashHex) return false;
  const salt = hexToBytes(saltHex);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashHex = bytesToHex(new Uint8Array(hash));
  return await safeEqual(hashHex, expectedHashHex);
}
__name(verifyPassword, "verifyPassword");
async function hmacSign(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}
__name(hmacSign, "hmacSign");
async function sha256(message) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return bytesToHex(new Uint8Array(hash));
}
__name(sha256, "sha256");
async function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);
  const left = new Uint8Array(aHash);
  const right = new Uint8Array(bHash);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}
__name(safeEqual, "safeEqual");
async function encryptText(secret, plaintext) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveAesKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `v1:${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}
__name(encryptText, "encryptText");
async function decryptText(secret, encrypted) {
  const [version, ivHex, ciphertextHex] = encrypted.split(":");
  if (version !== "v1" || !ivHex || !ciphertextHex) {
    throw new Error("upstream config is not encrypted; re-save upstream config");
  }
  const key = await deriveAesKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ciphertextHex)
  );
  return new TextDecoder().decode(plaintext);
}
__name(decryptText, "decryptText");
