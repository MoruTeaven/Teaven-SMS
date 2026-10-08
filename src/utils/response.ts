// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
function ok(data, message = "ok") {
  return Response.json({ code: 0, message, data });
}
__name(ok, "ok");
function fail(message, code = 1, status = 400) {
  return Response.json({ code, message, data: null }, { status });
}
__name(fail, "fail");
function unauthorized(message = "unauthorized") {
  return fail(message, 401, 401);
}
__name(unauthorized, "unauthorized");
function forbidden(message = "forbidden") {
  return fail(message, 403, 403);
}
__name(forbidden, "forbidden");
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowISO, "nowISO");
function parsePagination(url) {
  const u = new URL(url);
  const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(u.searchParams.get("pageSize") || "20", 10)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
__name(parsePagination, "parsePagination");
