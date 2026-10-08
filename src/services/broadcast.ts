// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
async function broadcastMessage(env, payload) {
  try {
    const id = env.MESSAGE_HUB.idFromName("global");
    const stub = env.MESSAGE_HUB.get(id);
    await stub.fetch("http://internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("broadcast message failed:", err);
  }
}
__name(broadcastMessage, "broadcastMessage");
