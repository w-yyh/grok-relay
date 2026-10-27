const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkText } = require("../scripts/check-release.cjs");
test("release audit rejects a JSON-escaped personal path in documentation", () => {
  const personal = ["C:", "Users", "ExamplePerson", "example"].join("\\");
  assert.throws(
    () => checkText(JSON.stringify({ path: personal }), "example.json"),
    /Personal Windows path/,
  );
});
