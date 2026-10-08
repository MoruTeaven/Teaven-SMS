// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function base64url(data) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64url, "base64url");
function base64urlDecode(data) {
  const binary = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
__name(base64urlDecode, "base64urlDecode");
async function signJwt(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = { ...payload, iat: now };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const message = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(secret, message);
  const signatureB64 = base64url(signature);
  return `${message}.${signatureB64}`;
}
__name(signJwt, "signJwt");
async function verifyJwt(secret, token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  const message = `${headerB64}.${payloadB64}`;
  const expectedSignature = await hmacSign(secret, message);
  const expectedB64 = base64url(expectedSignature);
  if (!await safeEqual(signatureB64, expectedB64)) return null;
  try {
    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJwt, "verifyJwt");
