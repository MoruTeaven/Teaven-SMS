// RECOVERED FROM DEPLOYED WORKER BUNDLE (deployment 2026-07-03, version 10df8f82)
// esbuild 已内联 import、擦除类型、重命名部分标识符（如 Hono2）。逻辑为原样，需重新补 import/类型才能通过 tsc。
import { DurableObject } from "cloudflare:workers";
var MessageHub = class extends DurableObject {
  static {
    __name(this, "MessageHub");
  }
  /**
   * å¤çæ¥èª Worker ä¸»å¥å£çè¯·æ±ï¼
   * - GET  (Upgrade: websocket): æ¥æ¶ WS æ¡æï¼æ³¨åä¼è¯
   * - POST /broadcast:            å¹¿æ­ä¸æ¡ç­ä¿¡äºä»¶ç»ææä¼è¯
   */
  async fetch(request) {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");
    if (upgrade === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const requestedProto = request.headers.get("Sec-WebSocket-Protocol");
      const headers = new Headers();
      if (requestedProto) {
        headers.set("Sec-WebSocket-Protocol", requestedProto.split(",")[0].trim());
      }
      return new Response(null, { status: 101, headers, webSocket: client });
    }
    if (request.method === "POST" && url.pathname === "/broadcast") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response("invalid json", { status: 400 });
      }
      const data = JSON.stringify(payload);
      let sent = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data);
          sent++;
        } catch {
          ws.close(1011, "send failed");
        }
      }
      return Response.json({ ok: true, sent });
    }
    return new Response("not found", { status: 404 });
  }
};
