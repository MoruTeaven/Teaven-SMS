// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var auth = new Hono2();
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
function isValidEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email);
}
__name(isValidEmail, "isValidEmail");
async function setupTokenMatches(c, bodyToken) {
  const expected = c.env.SETUP_TOKEN;
  const provided = c.req.header("X-Setup-Token") || bodyToken || "";
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}
__name(setupTokenMatches, "setupTokenMatches");
auth.get("/system-status", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS cnt FROM users").first();
  return ok({ hasUsers: Number(row?.cnt || 0) > 0 });
});
auth.post("/register", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email || "");
  if (!email || !body.password) {
    return fail("email and password are required");
  }
  if (!isValidEmail(email)) {
    return fail("invalid email format");
  }
  if (body.password.length < 8) {
    return fail("password must be at least 8 characters");
  }
  const userCount = await c.env.DB.prepare("SELECT COUNT(*) AS cnt FROM users").first();
  if (Number(userCount?.cnt || 0) === 0) {
    return fail("system is not initialized; bootstrap admin first", 403, 403);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return fail("email already registered");
  }
  const role = "user";
  const id = uuidv7();
  const passwordHash = await hashPassword(body.password);
  const now = nowISO();
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, nickname, role, status, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, email, passwordHash, body.nickname || null, role, "active", "0", now, now).run();
  const token = await signJwt(c.env.JWT_SECRET, { sub: id, role, exp: Math.floor(Date.now() / 1e3) + 86400 * 7 });
  return ok({ userId: id, role, token });
});
auth.post("/bootstrap-admin", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email || "");
  if (!await setupTokenMatches(c, body.setupToken)) {
    return fail("invalid setup token", 401, 401);
  }
  if (!email || !body.password) {
    return fail("email and password are required");
  }
  if (!isValidEmail(email)) {
    return fail("invalid email format");
  }
  if (body.password.length < 8) {
    return fail("password must be at least 8 characters");
  }
  const id = uuidv7();
  const passwordHash = await hashPassword(body.password);
  const now = nowISO();
  const role = "admin";
  const result = await c.env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, nickname, role, status, balance, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM users)
  `).bind(id, email, passwordHash, body.nickname || null, role, "active", "0", now, now).run();
  if (result.meta.changes === 0) {
    return fail("system already initialized", 409, 409);
  }
  const token = await signJwt(c.env.JWT_SECRET, { sub: id, role, exp: Math.floor(Date.now() / 1e3) + 86400 * 7 });
  return ok({ userId: id, role, token });
});
auth.post("/login", async (c) => {
  const body = await c.req.json();
  const email = normalizeEmail(body.email || "");
  if (!email || !body.password) {
    return fail("email and password are required");
  }
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    return fail("invalid email or password");
  }
  if (user.status !== "active") {
    return fail("account is disabled or suspended");
  }
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return fail("invalid email or password");
  }
  const token = await signJwt(c.env.JWT_SECRET, {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1e3) + 86400 * 7
  });
  return ok({ userId: user.id, role: user.role, token });
});
auth.get("/me", jwtAuth(), async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare("SELECT id, email, nickname, role, status, balance, created_at, updated_at FROM users WHERE id = ?").bind(userId).first();
  if (!user) {
    return fail("user not found");
  }
  return ok(user);
});
var auth_default = auth;
