// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
var adminDashboard = new Hono2();
adminDashboard.use("*", jwtAuth(), requireRole("admin"));
var dayKey = /* @__PURE__ */ __name((date) => date.toISOString().slice(0, 10), "dayKey");
var pct = /* @__PURE__ */ __name((part, total) => total > 0 ? Number((part / total * 100).toFixed(2)) : 0, "pct");
var trend = /* @__PURE__ */ __name((current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number(((current - previous) / previous * 100).toFixed(2));
}, "trend");
adminDashboard.get("/", async (c) => {
  const now = /* @__PURE__ */ new Date();
  const today = dayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = dayKey(yesterdayDate);
  const sinceDate = new Date(now);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 29);
  const since = dayKey(sinceDate);
  const [todayRow, yesterdayRow, activeUsersRow, seriesRows, upstreamRows, topChannelRows] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        COALESCE(SUM(price_units), 0) / 10000.0 AS revenue,
        COALESCE(SUM(cost_price_units), 0) / 10000.0 AS cost
      FROM sms_messages
      WHERE substr(created_at, 1, 10) = ?
    `).bind(today).first(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        COALESCE(SUM(price_units), 0) / 10000.0 AS revenue,
        COALESCE(SUM(cost_price_units), 0) / 10000.0 AS cost
      FROM sms_messages
      WHERE substr(created_at, 1, 10) = ?
    `).bind(yesterday).first(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE status = 'active'").first(),
    c.env.DB.prepare(`
      SELECT
        substr(created_at, 1, 10) AS day,
        COUNT(*) AS sends,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered
      FROM sms_messages
      WHERE substr(created_at, 1, 10) >= ?
      GROUP BY day
      ORDER BY day ASC
    `).bind(since).all(),
    c.env.DB.prepare(`
      SELECT COALESCE(u.name, m.upstream_id, 'unknown') AS name, COUNT(*) AS total
      FROM sms_messages m
      LEFT JOIN upstreams u ON u.id = m.upstream_id
      WHERE substr(m.created_at, 1, 10) = ?
      GROUP BY name
      ORDER BY total DESC
      LIMIT 8
    `).bind(today).all(),
    c.env.DB.prepare(`
      SELECT
        c.id,
        c.name,
        c.country_code,
        c.sms_type,
        u.name AS upstream_name,
        COUNT(m.id) AS daily_vol,
        SUM(CASE WHEN m.status = 'delivered' THEN 1 ELSE 0 END) AS delivered
      FROM channels c
      LEFT JOIN upstreams u ON u.id = c.upstream_id
      LEFT JOIN sms_messages m ON m.channel_id = c.id AND substr(m.created_at, 1, 10) = ?
      GROUP BY c.id
      ORDER BY daily_vol DESC
      LIMIT 6
    `).bind(today).all()
  ]);
  const todayTotal = Number(todayRow?.total || 0);
  const yesterdayTotal = Number(yesterdayRow?.total || 0);
  const todayDelivered = Number(todayRow?.delivered || 0);
  const todayFailed = Number(todayRow?.failed || 0);
  const yesterdayDelivered = Number(yesterdayRow?.delivered || 0);
  const yesterdayFailed = Number(yesterdayRow?.failed || 0);
  const todayRevenue = Number(todayRow?.revenue || 0);
  const todayCost = Number(todayRow?.cost || 0);
  const yesterdayRevenue = Number(yesterdayRow?.revenue || 0);
  const yesterdayCost = Number(yesterdayRow?.cost || 0);
  return ok({
    totalSends: todayTotal,
    successRate: pct(todayDelivered, todayTotal),
    failRate: pct(todayFailed, todayTotal),
    revenue: todayRevenue,
    cost: todayCost,
    activeUsers: Number(activeUsersRow?.total || 0),
    sendsTrend: trend(todayTotal, yesterdayTotal),
    successTrend: trend(pct(todayDelivered, todayTotal), pct(yesterdayDelivered, yesterdayTotal)),
    failTrend: trend(pct(todayFailed, todayTotal), pct(yesterdayFailed, yesterdayTotal)),
    revenueTrend: trend(todayRevenue, yesterdayRevenue),
    costTrend: trend(todayCost, yesterdayCost),
    activeTrend: 0,
    series: (seriesRows.results || []).map((row) => ({
      day: row.day,
      sends: Number(row.sends || 0),
      successRate: pct(Number(row.delivered || 0), Number(row.sends || 0))
    })),
    upstreamShare: (upstreamRows.results || []).map((row) => ({
      name: row.name,
      total: Number(row.total || 0)
    })),
    topChannels: (topChannelRows.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country_code,
      type: row.sms_type,
      upstream: row.upstream_name || "-",
      dailyVol: Number(row.daily_vol || 0),
      successRate: pct(Number(row.delivered || 0), Number(row.daily_vol || 0))
    }))
  });
});
var admin_dashboard_default = adminDashboard;
