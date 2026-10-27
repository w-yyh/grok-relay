const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { check } = require("../scripts/check-release.cjs");
test("release audit rejects a JSON-escaped personal path in documentation", () => {
  const file = path.join(__dirname, "../docs/release-check-test.json");
  const personal = ["C:", "Users", "ExamplePerson", "example"].join("\\");
  fs.writeFileSync(file, JSON.stringify({ path: personal }), { flag: "wx" });
  try {
    assert.throws(() => check(), /Personal Windows path/);
  } finally {
    fs.unlinkSync(file);
  }
});
