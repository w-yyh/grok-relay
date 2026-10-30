const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { stateDir, readContacts, writeContacts } = require("./config.cjs");

// The worker is the single writer for agent registrations. Other contact edits
// already stop the worker before writing, so concurrent joins cannot lose data.
function registerIdentity(identity, address, name) {
  const platform = identity.threadId ? "codex" : "grok";
  if (!new RegExp("^" + platform + ":[a-z0-9-]+$").test(address || ""))
    throw Error("Choose an address matching your platform");
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw Error("A display name of 1–120 characters is required");
  const book = readContacts();
  const key = platform === "codex" ? "threadId" : "botId";
  const existing = book[platform].find((c) => c[key] === identity[key]);
  if (existing) return { contact: existing, added: false };
  const contact = {
    ...identity,
    id: address,
    name: name.trim(),
    aliases: [],
    registeredAt: new Date().toISOString(),
  };
  book[platform].push(contact);
  writeContacts(book);
  return { contact, added: true };
}

async function requestRegistration(identity, address, name) {
  const id = randomUUID();
  const inbox = path.join(stateDir, "registrations");
  fs.mkdirSync(inbox, { recursive: true });
  const file = path.join(inbox, id + ".json"),
    result = path.join(inbox, id + ".result");
  fs.writeFileSync(
    file + ".tmp",
    JSON.stringify({ id, identity, address, name }),
  );
  fs.renameSync(file + ".tmp", file);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (fs.existsSync(result)) {
      const value = JSON.parse(fs.readFileSync(result, "utf8"));
      fs.unlinkSync(result);
      if (value.error) throw Error(value.error);
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Registration is pending. Check contacts before trying again.");
}
function registrationBaseline(entries, registeredAt) {
  return entries
    .filter((e) => !registeredAt || e.timestampMs < Date.parse(registeredAt))
    .map((e) => e.id);
}
module.exports = {
  registerIdentity,
  requestRegistration,
  registrationBaseline,
};
