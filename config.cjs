const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const localFile = path.join(__dirname, "runtime.local.json");
const local = fs.existsSync(localFile)
  ? JSON.parse(fs.readFileSync(localFile, "utf8"))
  : {};
const dataDir = path.resolve(
  process.env.BRIDGE_DATA_DIR ||
    local.dataDir ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), "GrokRelay"),
);
const stateDir = path.join(dataDir, "state");
const contactsFile = path.join(dataDir, "contacts.json");
function readContacts() {
  return fs.existsSync(contactsFile)
    ? validateContacts(JSON.parse(fs.readFileSync(contactsFile, "utf8")))
    : { version: 1, codex: [], grok: [] };
}
function validateContacts(value) {
  if (!Array.isArray(value.codex) || !Array.isArray(value.grok))
    throw Error("Invalid contacts configuration");
  const names = new Set();
  for (const [kind, contacts] of [
    ["codex", value.codex],
    ["grok", value.grok],
  ]) {
    for (const c of contacts) {
      if (
        !new RegExp("^" + kind + ":[a-z0-9-]+$").test(c.id) ||
        typeof c.name !== "string" ||
        !c.name.trim()
      )
        throw Error("A valid address and name are required");
      c.aliases = Array.isArray(c.aliases) ? c.aliases.filter(Boolean) : [];
      if (!c.aliases.every((alias) => typeof alias === "string"))
        throw Error("Aliases must be strings");
      for (const name of new Set(
        [c.id, c.name, ...c.aliases].map((s) => s.trim().toLowerCase()),
      )) {
        if (names.has(name))
          throw Error("Duplicate contact name or alias: " + name);
        names.add(name);
      }
      if (kind === "codex" && (!c.threadId || !path.isAbsolute(c.cwd || "")))
        throw Error(
          "Codex contacts require a thread ID and an absolute workspace path",
        );
      if (kind === "grok" && !c.botId)
        throw Error("Grok contacts require a bot ID");
      if (kind === "codex") c.hostId = "local";
    }
  }
  return { version: 1, codex: value.codex, grok: value.grok };
}
function writeContacts(value) {
  const result = validateContacts(value);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(contactsFile + ".tmp", JSON.stringify(result, null, 2));
  fs.renameSync(contactsFile + ".tmp", contactsFile);
}
module.exports = {
  dataDir,
  stateDir,
  contactsFile,
  readContacts,
  writeContacts,
  validateContacts,
  local,
};
