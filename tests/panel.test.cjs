const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// Disposable test data lives beneath the project, never in user chat storage.
const temp = fs.mkdtempSync(path.join(__dirname, "panel-fixture-"));
process.env.BRIDGE_DATA_DIR = temp;
const { writeContacts, validateContacts } = require("../config.cjs");
const { createServer } = require("../panel-server.cjs");
test("HTTP message bodies preserve UTF-8 characters split across chunks", async () => {
  const { readJsonBody } = require("../panel-server.cjs");
  const bytes = Buffer.from(JSON.stringify({ text: "你好 — résumé" }));
  async function* chunks() {
    for (const byte of bytes) yield Buffer.from([byte]);
  }
  assert.deepEqual(await readJsonBody(chunks()), { text: "你好 — résumé" });
});
after(() => fs.rmSync(temp, { recursive: true, force: true }));
test("local panel: empty state, enqueue, invalid input and cross-origin requests", async () => {
  writeContacts({
    codex: [],
    grok: [
      { id: "grok:a", name: "A", botId: "a", aliases: [] },
      { id: "grok:b", name: "B", botId: "b", aliases: [] },
    ],
  });
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const state = await (await fetch(url + "/api/status")).json();
    assert.equal(state.running, false);
    assert.equal(state.contacts.length, 2);
    const response = await fetch(url + "/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "grok:a", to: "grok:b", text: "hello" }),
    });
    assert.equal(response.status, 202);
    const receipt = await response.json();
    const queued = JSON.parse(
      fs.readFileSync(
        path.join(temp, "state/inbox", receipt.id + ".json"),
        "utf8",
      ),
    );
    assert.equal(queued.text, "hello");
    assert.equal(
      (
        await fetch(url + "/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(url + "/api/status", {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(url + "/contacts.json")).status, 404);
    assert.equal(
      (await fetch(url + "/", { headers: { "sec-fetch-site": "cross-site" } }))
        .status,
      200,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("ambiguous contact aliases are rejected", () => {
  assert.throws(
    () =>
      validateContacts({
        codex: [],
        grok: [
          { id: "grok:a", name: "A", botId: "a", aliases: ["same"] },
          { id: "grok:b", name: "B", botId: "b", aliases: ["same"] },
        ],
      }),
    /Duplicate/,
  );
});

test("language is persisted without changing pause state or user content", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  const post = (route, value) =>
    fetch(url + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  try {
    assert.equal(
      (await (await fetch(url + "/api/status")).json()).language,
      "en",
    );
    await post("/api/control", { action: "stop" });
    const saved = await (
      await post("/api/preferences", { language: "zh-CN" })
    ).json();
    assert.equal(saved.paused, true);
    assert.equal(saved.language, "zh-CN");
    await post("/api/control", { action: "stop" });
    const state = await (await fetch(url + "/api/status")).json();
    assert.equal(state.language, "zh-CN");
    assert.equal(state.running, false);
    assert.equal(state.contacts[0].name, "A");
    assert.equal(
      (await post("/api/preferences", { language: "de" })).status,
      400,
    );
    assert.equal(
      (await (await fetch(url + "/api/status")).json()).language,
      "zh-CN",
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(temp, "state/preferences.json"), "utf8"),
      ).language,
      "zh-CN",
    );
    assert.equal((await fetch(url + "/i18n.js")).status, 200);
    assert.equal(
      (await fetch(url + "/logo.svg")).headers.get("content-type"),
      "image/svg+xml; charset=utf-8",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
