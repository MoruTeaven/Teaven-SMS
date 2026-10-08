// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function corsMiddleware() {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Access-Key, X-Timestamp, X-Nonce, X-Signature",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    await next();
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Access-Key, X-Timestamp, X-Nonce, X-Signature");
  };
}
__name(corsMiddleware, "corsMiddleware");
function jwtAuth() {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return unauthorized("missing or invalid authorization header");
    }
    const token = authHeader.slice(7);
    const payload = await verifyJwt(c.env.JWT_SECRET, token);
    if (!payload) {
      return unauthorized("invalid or expired token");
    }
    const user = await c.env.DB.prepare("SELECT id, role, status FROM users WHERE id = ?").bind(payload.sub).first();
    if (!user || user.status !== "active") {
      return unauthorized("user is disabled or does not exist");
    }
    c.set("userId", user.id);
    c.set("userRole", user.role);
    await next();
  };
}
__name(jwtAuth, "jwtAuth");
function requireRole(...roles) {
  return async (c, next) => {
    const userRole = c.get("userRole");
    if (!userRole || !roles.includes(userRole)) {
      return forbidden("insufficient permissions");
    }
    await next();
  };
}
__name(requireRole, "requireRole");
function errorHandler2() {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      console.error("unhandled error:", err);
      const message = err instanceof Error ? err.message : "internal server error";
      return Response.json({ code: 500, message, data: null }, { status: 500 });
    }
  };
}
__name(errorHandler2, "errorHandler");
