const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalize, translate, zh } = require("../panel/i18n.js");

test("language defaults to English and interpolates translated counters", () => {
  assert.equal(normalize(undefined), "en");
  assert.equal(normalize("fr"), "en");
  assert.equal(translate("en", "Settings"), "Settings");
  assert.equal(translate("zh-CN", "Settings"), "设置");
  assert.equal(
    translate("zh-CN", "{online} / {total} contacts connected", {
      online: 2,
      total: 3,
    }),
    "2 / 3 个联系人已连接",
  );
  assert.equal(translate("zh-CN", "Unknown diagnostic"), "Unknown diagnostic");
});

test("all marked interface strings have Chinese translations", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../panel/index.html"),
    "utf8",
  );
  const keys = [
    ...html.matchAll(
      /data-i18n(?:-title|-aria-label|-placeholder)?="([^"]+)"/g,
    ),
  ].map((match) => match[1]);
  assert.ok(keys.length > 70);
  for (const key of keys) assert.ok(zh[key], "Missing translation: " + key);
});
