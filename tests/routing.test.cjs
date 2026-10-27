const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../communication-core.cjs");
// Isolated in-memory fixture; no account or local address book is required.
core.allContacts.splice(
  0,
  core.allContacts.length,
  { id: "grok:writer", name: "Writer", aliases: ["写作"], description: "内容" },
  { id: "codex:site", name: "Site", aliases: ["网站"] },
);
test("only an explicit whole-message envelope dispatches", () => {
  assert.equal(core.parseEnvelope("普通消息"), null);
  assert.equal(
    core.parseEnvelope("示例：\n[[bridge:send 写作]]\nhello\n[[/bridge]]"),
    null,
  );
  assert.equal(
    core.parseEnvelope("```\n[[bridge:send 写作]]\nhello\n[[/bridge]]\n```"),
    null,
  );
  assert.deepEqual(
    core.parseEnvelope("[[bridge:send 写作]]\n你好\n第二行\n[[/bridge]]"),
    { kind: "send", to: "grok:writer", text: "你好\n第二行" },
  );
  assert.throws(() =>
    core.parseEnvelope("[[bridge:send missing]]\nhello\n[[/bridge]]"),
  );
});
test("directory query and final response extraction", () => {
  assert.deepEqual(core.parseEnvelope("[[bridge:contacts]]"), {
    kind: "contacts",
  });
  assert.match(core.directory("内容"), /grok:writer/);
  assert.equal(
    core.finalOf({
      items: [
        { type: "agentMessage", phase: "commentary", text: "wait" },
        { type: "agentMessage", phase: "final_answer", text: "done" },
      ],
    }),
    "done",
  );
});
test("explicit response envelopes route instead of echoing protocol to the sender", () => {
  assert.equal(
    core.isCommand("[[bridge:send Site]]\n请处理\n[[/bridge]]"),
    true,
  );
  assert.equal(
    core.isCommand("[[bridge:send unknown]]\n请处理\n[[/bridge]]"),
    true,
  );
  assert.equal(core.isCommand("已处理"), false);
});
