const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync, execFile } = require("node:child_process");
const { local } = require("./config.cjs");
const gbot =
  process.env.BRIDGE_GROK_CLI ||
  local.grokCli ||
  path.join(__dirname, "node_modules/grok-bot-cli/dist/bin/gbot.mjs");
const pwsh = process.env.BRIDGE_POWERSHELL || local.powershell || "pwsh.exe";
function accessToken() {
  const dir = path.join(process.env.APPDATA, "Grok Bot");
  const store = JSON.parse(
    fs.readFileSync(path.join(dir, "sand-secrets.json"), "utf8"),
  );
  const accounts = JSON.parse(store["cursor-accounts"]);
  const encrypted =
    accounts.accounts?.[accounts.active]?.["cursor-access-token"];
  if (!encrypted) throw Error("No active Grok desktop account access token");
  const local = JSON.parse(
    fs.readFileSync(path.join(dir, "Local State"), "utf8"),
  );
  const wrapped = Buffer.from(local.os_crypt?.encrypted_key || "", "base64");
  if (wrapped.subarray(0, 5).toString() !== "DPAPI")
    throw Error("Unsupported Grok desktop storage");
  const unwrapped = execFileSync(
    pwsh,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      path.join(__dirname, "unprotect-current-user.ps1"),
    ],
    {
      input: wrapped.subarray(5).toString("base64"),
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    },
  );
  const key = Buffer.from(unwrapped, "base64");
  try {
    const b = Buffer.from(encrypted, "base64");
    if (b.subarray(0, 3).toString() !== "v10")
      throw Error("Unsupported token format");
    const d = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(3, 15));
    d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(15, -16)), d.final()]).toString(
      "utf8",
    );
  } finally {
    key.fill(0);
  }
}
async function grok(args) {
  const token = accessToken();
  const desktop = JSON.parse(
    fs.readFileSync(
      path.join(process.env.APPDATA, "Grok Bot/desktop-status.json"),
      "utf8",
    ),
  );
  const env = {
    ...process.env,
    CURSOR_ACCESS_TOKEN: token,
    GROK_BOT_HISTORY: "off",
    SAND_CLIENT_VERSION: desktop.appVersion,
  };
  delete env.CODEX_THREAD_ID;
  delete env.CODEX_TURN_ID;
  delete env.CODEX_SESSION_ID;
  return new Promise((resolve, reject) =>
    execFile(
      process.execPath,
      [gbot, ...args, "--json"],
      {
        env,
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        let result;
        try {
          result = JSON.parse(stdout);
        } catch {
          const detail = String(
            stderr || stdout || error?.message || "Invalid Grok response",
          )
            .replaceAll(token, "[redacted]")
            .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
          reject(Error(detail.slice(0, 1000)));
          return;
        }
        if (error || result.error) {
          const message =
            result.error?.message || result.error || "Grok request failed";
          reject(
            Error(
              String(message).replaceAll(token, "[redacted]").slice(0, 600),
            ),
          );
          return;
        }
        resolve(result);
      },
    ),
  );
}
module.exports = { grok };
if (require.main === module)
  grok(["bots", "list", "--gateway"])
    .then((r) => {
      if (Array.isArray(r))
        console.log(JSON.stringify(r.map((b) => ({ id: b.id, name: b.name }))));
      else console.log(JSON.stringify({ keys: Object.keys(r), result: r }));
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
