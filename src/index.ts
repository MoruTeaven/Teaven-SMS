// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var app = new Hono2();
app.use("*", corsMiddleware());
app.use("*", errorHandler2());
app.get("/health", (c) => c.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
app.route("/api/auth", auth_default);
app.route("/api/api-keys", api_keys_default);
app.route("/api/sms", sms_default);
app.route("/api/user", user_center_default);
app.route("/api/user/signatures", user_signatures_default);
app.route("/api/user/templates", user_templates_default);
app.route("/api/admin/upstreams", admin_upstreams_default);
app.route("/api/admin/reviews", admin_reviews_default);
app.route("/api/admin/mappings", admin_mappings_default);
app.route("/api/admin/users", admin_users_default);
app.route("/api/admin/dashboard", admin_dashboard_default);
app.route("/api/admin/ws", admin_ws_default);
app.route("/api/admin/public-templates", admin_public_templates_default);
app.route("/webhooks", webhooks_default);
app.get("/admin", (c) => c.html(ADMIN_HTML));
app.get("/user", (c) => c.html(USER_HTML));
app.notFound((c) => c.json({ code: 404, message: "not found", data: null }, { status: 404 }));
var index_default = {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    if (batch.queue === "teaven-sms-send") {
      await handleSendQueue(batch, env);
    } else if (batch.queue === "teaven-sms-receipt") {
      await handleReceiptQueue(batch, env);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(drainSmsOutbox(env.DB, env.SMS_SEND_QUEUE));
  }
};
export {
  MessageHub,
  index_default as default
};
//# sourceMappingURL=index.js.map
