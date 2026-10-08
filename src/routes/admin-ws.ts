// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminWs = new Hono2();
adminWs.get("/messages", async (c) => {
  let token;
  const protoHeader = c.req.header("Sec-WebSocket-Protocol");
  if (protoHeader) {
    const parts = protoHeader.split(",").map((s) => s.trim());
    const bearerProto = parts.find((p) => p.startsWith("bearer."));
    if (bearerProto) token = bearerProto.slice("bearer.".length);
  }
  if (!token) {
    token = c.req.query("token");
  }
  if (!token) return unauthorized("missing token");
  const payload = await verifyJwt(c.env.JWT_SECRET, token);
  if (!payload) return unauthorized("invalid or expired token");
  const user = await c.env.DB.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(payload.sub).first();
  if (!user || user.status !== "active") return unauthorized("user is disabled or does not exist");
  if (user.role !== "admin") return forbidden("admin only");
  const id = c.env.MESSAGE_HUB.idFromName("global");
  const stub = c.env.MESSAGE_HUB.get(id);
  return stub.fetch(c.req.raw);
});
var admin_ws_default = adminWs;
