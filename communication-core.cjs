const fs = require("node:fs");
const path = require("node:path");
const { DesktopIpc } = require("./codex-desktop-ipc.cjs");
const contacts = require("./config.cjs").readContacts();
const allContacts = [...contacts.codex, ...contacts.grok];
function findContact(query) {
  const q = query.toLowerCase().trim();
  const exact = allContacts.filter((c) =>
    [c.id, c.name, ...c.aliases].some((s) => s.toLowerCase() === q),
  );
  if (exact.length !== 1)
    throw Error("Contact not found or ambiguous: " + query);
  return exact[0];
}
function directory(query = "") {
  const q = query.toLowerCase();
  return allContacts
    .filter((c) =>
      JSON.stringify([c.id, c.name, c.aliases, c.description])
        .toLowerCase()
        .includes(q),
    )
    .map(
      (c) =>
        c.id + " | " + c.name + (c.description ? " | " + c.description : ""),
    )
    .join("\n");
}
function parseEnvelope(text) {
  const body = String(text).trim();
  if (body === "[[bridge:contacts]]") return { kind: "contacts" };
  const match =
    /^\[\[bridge:send ([^\]\r\n]+)\]\]\s*\n([\s\S]*?)\n\[\[\/bridge\]\]$/.exec(
      body,
    );
  if (!match) return null;
  return { kind: "send", to: findContact(match[1]).id, text: match[2].trim() };
}
function isCommand(text) {
  try {
    return parseEnvelope(text) !== null;
  } catch {
    return true;
  }
}
function turnsOf(state) {
  return [
    ...(state?.turns || []),
    ...Object.values(state?.turnHistory?.history?.entitiesByKey || {}),
  ];
}
function finalOf(turn) {
  return (turn.items || [])
    .filter((i) => i.type === "agentMessage" && i.phase === "final_answer")
    .map((i) => i.text)
    .join("\n")
    .trim();
}
function applyPatch(root, p) {
  let target = root;
  for (const k of p.path.slice(0, -1)) {
    if (target[k] === undefined) throw Error("Desktop stream path missing");
    target = target[k];
  }
  const k = p.path.at(-1);
  if (p.op === "remove") {
    if (Array.isArray(target)) target.splice(Number(k), 1);
    else delete target[k];
  } else if (p.op === "add" && Array.isArray(target))
    target.splice(Number(k), 0, p.value);
  else if (p.op === "add" || p.op === "replace") target[k] = p.value;
  else throw Error("Unsupported desktop stream patch");
}
class DesktopConnection {
  constructor(contact) {
    this.contact = contact;
    this.state = null;
    this.revision = null;
    this.problem = null;
    this.observers = new Set();
  }
  async connect() {
    this.ipc = await new DesktopIpc({
      threadIds: [this.contact.threadId],
    }).connect();
    try {
      const o = await this.ipc.request(
        "thread-owner-discovery",
        { hostId: this.contact.hostId, conversationId: this.contact.threadId },
        1,
      );
      this.owner = o.handledByClientId;
      this.ipc.listeners.add((m) => {
        const c = m.params.change;
        if (!c) return;
        try {
          if (c.type === "snapshot") {
            this.state = c.conversationState;
            this.revision = c.revision;
            this.problem = null;
          } else if (c.type === "patches") {
            if (c.baseRevision !== this.revision)
              throw Error("Desktop stream revision gap");
            for (const p of c.patches) applyPatch(this.state, p);
            this.revision = c.revision;
          }
          for (const f of this.observers) f(this.state);
        } catch (e) {
          this.problem = e.message;
        }
      });
      this.ipc.socket.on("close", () => {
        this.problem = "Desktop disconnected";
      });
      this.ipc.broadcast(
        "thread-stream-following-changed",
        {
          conversationId: this.contact.threadId,
          hostId: this.contact.hostId,
          following: true,
        },
        1,
        [this.owner],
      );
      const deadline = Date.now() + 6000;
      while (!this.state && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 50));
      if (this.state?.id !== this.contact.threadId)
        throw Error("Desktop snapshot unavailable");
      if (
        path.resolve(this.state.cwd).toLowerCase() !==
        path.resolve(this.contact.cwd).toLowerCase()
      )
        throw Error("Desktop workspace changed");
      return this;
    } catch (e) {
      this.close();
      throw e;
    }
  }
  async send(text) {
    if (this.problem) throw Error(this.problem);
    if (this.state?.threadRuntimeStatus?.type !== "idle")
      throw Error("DESKTOP_BUSY");
    const r = await this.ipc.request(
      "thread-follower-start-turn",
      {
        conversationId: this.contact.threadId,
        turnStart: {
          request: {
            threadId: this.contact.threadId,
            input: [{ type: "text", text, text_elements: [] }],
          },
          context: { inheritThreadSettings: true },
        },
      },
      2,
      this.owner,
    );
    const id = r.result?.result?.turn?.id;
    if (!id) throw Error("Desktop delivery result unknown");
    return id;
  }
  close() {
    if (this.owner && !this.ipc?.socket?.destroyed)
      this.ipc.broadcast(
        "thread-stream-following-changed",
        {
          conversationId: this.contact.threadId,
          hostId: this.contact.hostId,
          following: false,
        },
        1,
        [this.owner],
      );
    this.ipc?.close();
  }
}
module.exports = {
  contacts,
  allContacts,
  findContact,
  directory,
  parseEnvelope,
  isCommand,
  turnsOf,
  finalOf,
  DesktopConnection,
};
