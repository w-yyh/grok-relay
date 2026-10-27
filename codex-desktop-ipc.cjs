const net = require("node:net");
const { randomUUID } = require("node:crypto");
class DesktopIpc {
  constructor({ threadIds = [] } = {}) {
    this.threadIds = new Set(threadIds);
    this.pending = new Map();
    this.clientId = "initializing-client";
    this.buffer = Buffer.alloc(0);
    this.listeners = new Set();
  }
  async connect() {
    this.socket = net.createConnection("\\\\.\\pipe\\codex-ipc");
    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 4) {
        const n = this.buffer.readUInt32LE(0);
        if (!n || n > 268435456) {
          this.socket.destroy(new Error("Invalid frame"));
          return;
        }
        if (this.buffer.length < 4 + n) break;
        const msg = JSON.parse(this.buffer.subarray(4, 4 + n).toString());
        this.buffer = this.buffer.subarray(4 + n);
        this.onMessage(msg);
      }
    });
    await new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });
    this.socket.on("close", () =>
      this.rejectPending(new Error("Desktop disconnected")),
    );
    this.socket.on("error", (e) => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(e);
      }
      this.pending.clear();
    });
    const hello = await this.request(
      "initialize",
      { clientType: "grok-desktop-bridge-probe" },
      0,
    );
    this.clientId = hello.result.clientId;
    return this;
  }
  send(msg) {
    const body = Buffer.from(JSON.stringify(msg));
    const head = Buffer.alloc(4);
    head.writeUInt32LE(body.length);
    this.socket.write(Buffer.concat([head, body]));
  }
  onMessage(msg) {
    if (msg.type === "response") {
      const p = this.pending.get(msg.requestId);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(msg.requestId);
        msg.resultType === "success"
          ? p.resolve(msg)
          : p.reject(new Error(msg.error || "IPC failed"));
      }
    }
    if (msg.type === "client-discovery-request")
      this.send({
        type: "client-discovery-response",
        requestId: msg.requestId,
        response: { canHandle: false },
      });
    if (
      msg.type === "broadcast" &&
      this.threadIds.has(msg.params?.conversationId)
    )
      for (const fn of this.listeners) fn(msg);
  }
  request(method, params, version, targetClientId) {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Request timed out: " + method));
      }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.send({
        type: "request",
        requestId,
        sourceClientId: this.clientId,
        version,
        method,
        params,
        targetClientId,
        timeoutMs: 14000,
      });
    });
  }
  broadcast(method, params, version, targetClientIds) {
    this.send({
      type: "broadcast",
      sourceClientId: this.clientId,
      version,
      method,
      params,
      targetClientIds,
    });
  }
  close() {
    this.rejectPending(new Error("Desktop disconnected"));
    this.socket?.destroy();
  }
  rejectPending(error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
}
module.exports = { DesktopIpc };
if (require.main === module)
  (async () => {
    const c = require("./config.cjs").readContacts().codex[0];
    if (!c) throw Error("No Codex contact configured");
    const ipc = await new DesktopIpc({ threadIds: [c.threadId] }).connect();
    try {
      const owner = await ipc.request(
        "thread-owner-discovery",
        { hostId: c.hostId, conversationId: c.threadId },
        1,
      );
      console.log(
        JSON.stringify({
          connected: true,
          ownerFound: true,
          targetThread: c.threadId,
          title: c.name,
        }),
      );
    } finally {
      ipc.close();
    }
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
