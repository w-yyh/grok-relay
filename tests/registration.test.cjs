const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const temp = fs.mkdtempSync(path.join(__dirname, "registration-fixture-"));
process.env.BRIDGE_DATA_DIR = temp;
const { registerIdentity } = require("../registration.cjs");
const core = require("../communication-core.cjs");
after(() => fs.rmSync(temp, { recursive: true, force: true }));
test("first poll retains messages sent immediately after registration", () => {
  const { registrationBaseline } = require("../registration.cjs");
  const entries = [
    { id: "old", timestampMs: 100 },
    { id: "new", timestampMs: 300 },
  ];
  assert.deepEqual(registrationBaseline(entries, new Date(200).toISOString()), [
    "old",
  ]);
  assert.deepEqual(registrationBaseline(entries), ["old", "new"]);
});

test("explicit registration is idempotent and hot-reloads without restarting", () => {
  assert.equal(
    registerIdentity({ botId: "a" }, "grok:writer", "Writer").added,
    true,
  );
  core.reloadContacts();
  assert.equal(core.findContact("Writer").botId, "a");
  const second = registerIdentity({ botId: "a" }, "grok:another", "Other name");
  assert.equal(second.added, false);
  assert.equal(second.contact.id, "grok:writer");
  assert.throws(
    () => registerIdentity({ botId: "b" }, "grok:writer", "Other"),
    /Duplicate/,
  );
  const group = registerIdentity(
    { botId: "group", kind: "group" },
    "grok:team",
    "Team",
  );
  assert.equal(group.contact.kind, "group");
});
test("registration envelopes are standalone commands, not quoted examples", () => {
  const envelope = "[[bridge:register grok:writer]]\nWriter\n[[/bridge]]";
  assert.deepEqual(core.parseEnvelope(envelope), {
    kind: "register",
    address: "grok:writer",
    name: "Writer",
  });
  assert.equal(core.parseEnvelope("Example:\n" + envelope), null);
  assert.equal(core.parseEnvelope("```\n" + envelope + "\n```"), null);
});
