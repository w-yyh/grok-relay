const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatMessage, reconcileIdentities } = require("../message-format.cjs");
test("chat contains only sender, type and exact body", () => {
  const job = {
    from: "grok:employee",
    kind: "message",
    id: "internal-id",
    text: "请调整标题。\n保留第二行。",
  };
  assert.equal(
    formatMessage(job, () => ({ name: "Morgan（内容）" })),
    "Morgan · Message\n\n请调整标题。\n保留第二行。",
  );
  assert.equal(
    formatMessage({ ...job, kind: "reply" }, () => ({ name: "Morgan" })),
    "Morgan · Reply\n\n请调整标题。\n保留第二行。",
  );
});
test("identical messages correlate distinct requests without visible identifiers", () => {
  const jobs = [1, 2].map((id) => ({
    id,
    to: "grok:a",
    kind: "message",
    attemptedAt: "2026-01-01T00:00:10Z",
    wireText: "Codex · Message\n\n你好",
    status: "waiting_identity",
  }));
  const entries = [1, 2].map((id) => ({
    kind: "message",
    requestId: "req" + id,
    timestampMs: Date.parse("2026-01-01T00:00:12Z") + id,
    content: jobs[0].wireText,
  }));
  assert.deepEqual(reconcileIdentities(jobs, "grok:a", entries), [1, 2]);
  assert.equal(jobs[0].requestId, "req1");
  assert.equal(jobs[1].requestId, "req2");
  assert.deepEqual(reconcileIdentities(jobs, "grok:a", entries), []);
});
test("old matching messages do not acquire a new delivery", () => {
  const jobs = [
    {
      id: 1,
      to: "grok:a",
      kind: "message",
      attemptedAt: "2026-01-01T00:10:00Z",
      wireText: "hello",
    },
  ];
  assert.deepEqual(
    reconcileIdentities(jobs, "grok:a", [
      {
        kind: "message",
        requestId: "old",
        timestampMs: Date.parse("2026-01-01T00:00:00Z"),
        content: "hello",
      },
    ]),
    [],
  );
});
test("Grok trimming terminal newlines does not leave an accepted send unconfirmed", () => {
  const job = {
    id: "trim",
    to: "grok:a",
    kind: "reply",
    status: "delivery_unknown",
    attemptedAt: "2026-01-01T00:00:00Z",
    wireText: "Codex · Reply\r\n\r\nhello\n",
  };
  const entry = {
    kind: "message",
    requestId: "r-trim",
    timestampMs: Date.parse("2026-01-01T00:00:01Z"),
    content: "Codex · Reply\n\nhello",
  };
  assert.deepEqual(reconcileIdentities([job], "grok:a", [entry]), ["trim"]);
  assert.equal(job.status, "delivered");
});
test("reply request is correlated, preventing normal acknowledgments from becoming outgoing work", () => {
  const jobs = [
    {
      id: 1,
      to: "grok:a",
      kind: "reply",
      attemptedAt: "2026-01-01T00:00:00Z",
      wireText: "Codex · Reply\n\n好",
    },
  ];
  reconcileIdentities(jobs, "grok:a", [
    {
      kind: "message",
      requestId: "r",
      timestampMs: Date.parse("2026-01-01T00:00:01Z"),
      content: jobs[0].wireText,
    },
  ]);
  assert.equal(jobs[0].requestId, "r");
  assert.equal(jobs[0].status, "delivered");
});
test("group posts without request IDs correlate only replies in the same turn", () => {
  const {
    reconcileIdentities,
    matchesReply,
  } = require("../message-format.cjs");
  const at = "2026-01-01T00:00:00.000Z";
  const job = {
    id: "group-test",
    to: "grok:team",
    kind: "message",
    attemptedAt: at,
    wireText: "Writer · Message\n\nPlease review.",
    status: "waiting_identity",
  };
  const entry = {
    id: "t12u",
    kind: "message",
    timestampMs: Date.parse(at),
    clientNonce: "fictional",
    content: job.wireText,
  };
  assert.deepEqual(reconcileIdentities([job], "grok:team", [entry]), []);
  assert.deepEqual(reconcileIdentities([job], "grok:team", [entry], true), [
    "group-test",
  ]);
  assert.equal(job.status, "waiting_reply");
  assert.equal(
    matchesReply(job, {
      id: "t12s4",
      kind: "send-message",
      requestId: "post:fictional",
    }),
    true,
  );
  assert.equal(matchesReply(job, { id: "t13s4", kind: "send-message" }), false);
  assert.equal(matchesReply(job, { id: "t12u", kind: "message" }), false);
  assert.deepEqual(reconcileIdentities([job], "grok:team", [entry], true), []);
});
