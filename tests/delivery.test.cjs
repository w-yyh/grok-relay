const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DesktopConnection } = require("../communication-core.cjs");
const { reconcileCodex } = require("../delivery.cjs");
test("polling selects the oldest due contact, including newly registered contacts", () => {
  const { nextContactToRead } = require("../delivery.cjs");
  const contacts = [{ id: "first" }, { id: "second" }, { id: "new" }];
  const next = new Map([
    ["first", 90],
    ["second", 30],
  ]);
  assert.equal(nextContactToRead(contacts, next, new Set(), 100).id, "new");
  assert.equal(
    nextContactToRead(contacts, next, new Set(["new"]), 100).id,
    "second",
  );
  assert.equal(
    nextContactToRead(contacts, next, new Set(["first", "second", "new"]), 100),
    undefined,
  );
});

test("active Codex messages steer the existing turn immediately; idle ones start a turn", async () => {
  const c = new DesktopConnection({ threadId: "fictional-thread" });
  c.owner = "owner";
  c.state = { threadRuntimeStatus: { type: "active" } };
  const calls = [];
  c.ipc = {
    request: async (...args) => {
      calls.push(args);
      return {
        result: { result: { turnId: "active-turn", turn: { id: "new-turn" } } },
      };
    },
  };
  assert.equal(await c.send("hello", "client-one"), "active-turn");
  assert.equal(calls[0][0], "thread-follower-steer-turn");
  assert.equal(calls[0][1].clientUserMessageId, "client-one");
  c.state.threadRuntimeStatus.type = "idle";
  assert.equal(await c.send("reply", "client-two"), "new-turn");
  assert.equal(calls[1][0], "thread-follower-start-turn");
  assert.equal(calls[1][1].turnStart.request.clientUserMessageId, "client-two");
});

test("timeout recovery requires a matching observed user item; missing IDs never match", () => {
  const jobs = [
    {
      id: "a",
      to: "codex:site",
      status: "delivery_unknown",
      kind: "message",
      attemptedAt: "2026-01-01T00:00:10Z",
      wireText: "actual\n",
    },
  ];
  const turn = {
    turnId: "t",
    turnStartedAtMs: Date.parse("2026-01-01T00:00:11Z"),
    items: [
      {
        type: "userMessage",
        id: "other",
        content: [{ type: "text", text: "unrelated" }],
      },
    ],
  };
  assert.deepEqual(reconcileCodex(jobs, "codex:site", [turn]), []);
  turn.items.push({
    type: "userMessage",
    id: "match",
    content: [{ type: "text", text: "actual" }],
  });
  assert.deepEqual(reconcileCodex(jobs, "codex:site", [turn]), ["a"]);
  assert.equal(jobs[0].status, "waiting_reply");
  assert.equal(jobs[0].turnId, "t");
  assert.deepEqual(reconcileCodex(jobs, "codex:site", [turn]), []);
});

test("steered input can belong to an older turn, but a pending optimistic item is not delivery", () => {
  const job = {
    id: "s",
    to: "codex:site",
    clientMessageId: "client-s",
    status: "delivery_unknown",
    kind: "reply",
    attemptedAt: "2026-01-01T00:05:00Z",
    wireText: "reply",
  };
  const item = {
    type: "steeringUserMessage",
    id: "i",
    clientUserMessageId: "client-s",
    status: "pending",
    text: "reply",
  };
  const turn = { turnId: "older", turnStartedAtMs: 0, items: [item] };
  assert.deepEqual(reconcileCodex([job], "codex:site", [turn]), []);
  item.status = "accepted";
  assert.deepEqual(reconcileCodex([job], "codex:site", [turn]), ["s"]);
  assert.equal(job.status, "delivered");
});
