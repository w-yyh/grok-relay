const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DesktopIpc } = require("../codex-desktop-ipc.cjs");
test("closing a desktop connection rejects in-flight requests instead of hanging the relay", async () => {
  const ipc = new DesktopIpc();
  ipc.socket = { write() {}, destroy() {} };
  const pending = ipc.request("test", {}, 1);
  ipc.close();
  await assert.rejects(pending, /disconnected/i);
  assert.equal(ipc.pending.size, 0);
});
