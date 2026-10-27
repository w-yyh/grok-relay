const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = fs.mkdtempSync(path.join(__dirname, "cli-fixture-"));
const env = { ...process.env, BRIDGE_DATA_DIR: path.join(root, "data") };
const config = {
  codex: [],
  grok: [
    {
      id: "grok:writer",
      name: "Writer",
      botId: "fictional-writer",
      aliases: ["editor"],
    },
    {
      id: "grok:reviewer",
      name: "Reviewer",
      botId: "fictional-reviewer",
      aliases: [],
    },
  ],
};
const input = path.join(root, "contacts.json");
fs.writeFileSync(input, JSON.stringify(config));
const cli = (...args) =>
  spawnSync(
    process.execPath,
    [path.join(__dirname, "../bridge.cjs"), ...args],
    { env, encoding: "utf8", windowsHide: true },
  );
after(() => fs.rmSync(root, { recursive: true, force: true }));
test("agent setup, discovery, enqueue and receipt work without a running worker", () => {
  let r = cli("init", "--file", input);
  assert.equal(r.status, 0, r.stderr);
  r = cli("contacts", "--query", "editor", "--json");
  assert.equal(JSON.parse(r.stdout)[0].id, "grok:writer");
  assert.equal(JSON.parse(r.stdout)[0].botId, undefined);
  r = cli(
    "send",
    "--from",
    "grok:writer",
    "--to",
    "grok:reviewer",
    "--message",
    "Please review this draft.",
  );
  assert.equal(r.status, 0, r.stderr);
  const receipt = JSON.parse(r.stdout);
  assert.equal(receipt.status, "queued");
  assert.equal(receipt.workerRunning, false);
  r = cli("message", "--id", receipt.id, "--include-text");
  assert.equal(JSON.parse(r.stdout).message.text, "Please review this draft.");
  r = cli("status");
  assert.equal(JSON.parse(r.stdout).running, false);
});
test("invalid commands and ambiguous sender/body fail without queuing messages", () => {
  for (const args of [
    ["missing-command"],
    ["send", "--to"],
    [
      "send",
      "--from",
      "grok:writer",
      "--to",
      "grok:writer",
      "--message",
      "hello",
    ],
    [
      "send",
      "--from",
      "grok:writer",
      "--to",
      "grok:reviewer",
      "--message",
      "hello",
      "--file",
      input,
    ],
  ]) {
    const r = cli(...args);
    assert.equal(r.status, 1);
    assert.equal(typeof JSON.parse(r.stderr).error, "string");
  }
});
