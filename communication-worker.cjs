const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { grok } = require("./grok-existing-session.cjs");
const {
  contacts,
  allContacts,
  findContact,
  directory,
  parseEnvelope,
  isCommand,
  turnsOf,
  finalOf,
  DesktopConnection,
} = require("./communication-core.cjs");
const {
  formatMessage,
  reconcileIdentities,
  matchesReply,
} = require("./message-format.cjs");
const root = require("./config.cjs").stateDir;
fs.mkdirSync(root, { recursive: true });
const statePath = path.join(root, "communication.json"),
  lockPath = path.join(root, "communication.pid"),
  stopPath = path.join(root, "communication.stop");
if (fs.existsSync(lockPath)) {
  const pid = Number(fs.readFileSync(lockPath, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {}
  if (alive) throw Error("Communication worker already running");
  fs.unlinkSync(lockPath);
}
fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
if (fs.existsSync(stopPath)) fs.unlinkSync(stopPath);
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { version: 1, seen: {}, jobs: [], routes: {} };
const desktops = new Map(),
  nextConnect = new Map(),
  nextPoll = new Map();
let running = true,
  lastSave = 0,
  flushBusy = false,
  pollBusy = false;
function save() {
  state.pid = process.pid;
  state.running = running;
  state.updatedAt = new Date().toISOString();
  const temp = statePath + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, statePath);
  lastSave = Date.now();
}
function log(event, info = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...info }));
}
function seen(source, key) {
  return (state.seen[source] || []).includes(key);
}
function mark(source, key) {
  const items = state.seen[source] || [];
  if (!items.includes(key)) items.push(key);
  state.seen[source] = items.slice(-600);
}
function enqueue(from, to, text, key, kind = "message", replyTo = null) {
  const id = key || randomUUID();
  if (state.jobs.some((j) => j.id === id)) return;
  state.jobs.push({
    id,
    from,
    to,
    text,
    kind,
    replyTo,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
  save();
  log("queued", { id, from, to, kind });
}
function notify(to, text, key) {
  enqueue("bridge", to, text, key, "notice");
}
function handleOutgoing(source, text, key) {
  let command;
  try {
    command = parseEnvelope(text);
  } catch (e) {
    notify(
      source,
      "Recipient not found: " + e.message + "\n" + directory(),
      "error:" + key,
    );
    return;
  }
  if (!command) return;
  if (command.kind === "contacts") {
    notify(source, "Available contacts:\n" + directory(), "directory:" + key);
    return;
  }
  if (command.to === source) {
    notify(source, "Choose a recipient other than yourself.", "self:" + key);
    return;
  }
  if (!command.text) {
    notify(source, "The message is empty; nothing was sent.", "empty:" + key);
    return;
  }
  enqueue(source, command.to, command.text, key);
}
function replyTo(job, text, entryId = null) {
  if (!entryId && job.replyQueued) return;
  if (!entryId) job.replyQueued = true;
  job.status = "answered";
  job.answeredAt = new Date().toISOString();
  enqueue(
    job.to,
    job.from,
    text,
    "reply:" + job.id + (entryId ? ":" + entryId : ""),
    "reply",
    job.id,
  );
}
function responseTo(job, text, entryId = null) {
  if (isCommand(text)) {
    handleOutgoing(job.to, text, job.to + ":" + (entryId || job.turnId));
    job.status = "answered";
    job.answeredAt = new Date().toISOString();
    job.replyQueued = true;
    if (entryId) job.handledEntries = [...(job.handledEntries || []), entryId];
    save();
  } else replyTo(job, text, entryId);
}
function inspectCodex(contact, d) {
  if (!d.state) return;
  const turns = turnsOf(d.state);
  if (!state.seen[contact.id]) {
    state.seen[contact.id] = turns
      .filter((t) => t.status === "completed")
      .map((t) => t.turnId || t.id)
      .filter(Boolean);
    save();
  }
  for (const t of turns) {
    const id = t.turnId || t.id;
    if (!id) continue;
    const incoming = state.jobs.find(
      (j) => j.to === contact.id && j.turnId === id,
    );
    if (incoming) {
      if (
        t.status === "completed" &&
        incoming.kind !== "message" &&
        !seen(contact.id, id)
      ) {
        handleOutgoing(contact.id, finalOf(t), contact.id + ":" + id);
        mark(contact.id, id);
        save();
      } else if (
        t.status === "completed" &&
        incoming.status === "waiting_reply"
      ) {
        const text = finalOf(t);
        if (text) responseTo(incoming, text);
        else {
          incoming.status = "completed_without_text";
          save();
        }
        mark(contact.id, id);
      } else if (
        ["failed", "interrupted"].includes(t.status) &&
        incoming.status === "waiting_reply"
      ) {
        incoming.status = t.status;
        notify(
          incoming.from,
          "The turn for " +
            contact.name +
            " is " +
            t.status +
            ". Check the original conversation.",
          "failed:" + incoming.id,
        );
        mark(contact.id, id);
        save();
      }
      continue;
    }
    if (t.status !== "completed" || seen(contact.id, id)) continue;
    const text = finalOf(t);
    handleOutgoing(contact.id, text, contact.id + ":" + id);
    mark(contact.id, id);
    save();
  }
}
function messageText(job) {
  return formatMessage(job, findContact);
}
async function connectDesktop(contact) {
  if (Date.now() < (nextConnect.get(contact.id) || 0)) return;
  nextConnect.set(contact.id, Date.now() + 30000);
  try {
    desktops.get(contact.id)?.close();
    const d = await new DesktopConnection(contact).connect();
    desktops.set(contact.id, d);
    state.routes[contact.id] = {
      status: "online",
      lastConnectedAt: new Date().toISOString(),
    };
    inspectCodex(contact, d);
    save();
    log("desktop_online", { id: contact.id });
  } catch (e) {
    desktops.delete(contact.id);
    state.routes[contact.id] = { status: "unavailable", error: e.message };
    save();
  }
}
async function flush() {
  if (flushBusy) return;
  flushBusy = true;
  try {
    for (const job of state.jobs.filter((j) => j.status === "queued")) {
      if (!running) break;
      const to = findContact(job.to);
      if (to.threadId) {
        const d = desktops.get(to.id);
        if (!d || d.problem) {
          job.waitReason = "recipient_unavailable";
          continue;
        }
        if (d.state?.threadRuntimeStatus?.type !== "idle") {
          job.waitReason = "recipient_busy";
          continue;
        }
      }
      delete job.waitReason;
      job.status = "sending";
      job.attemptedAt = new Date().toISOString();
      job.wireText = messageText(job);
      save();
      try {
        if (to.threadId) {
          job.turnId = await desktops.get(to.id).send(messageText(job));
        } else {
          const r = await grok([
            "send",
            to.botId,
            messageText(job),
            "--gateway",
            "--reply-mode",
            "manual",
            "--no-history",
          ]);
          job.requestId =
            r.requestId || r.result?.requestId || r.receipt?.requestId;
          job.transportAccepted =
            r.result?.accepted === true || r.delivery === "accepted";
          job.receiptKeys = Object.keys(r);
        }
        job.status =
          to.botId && !job.requestId
            ? "waiting_identity"
            : job.kind === "message"
              ? "waiting_reply"
              : "delivered";
        job.deliveredAt = new Date().toISOString();
        save();
        log("delivered", {
          id: job.id,
          to: job.to,
          kind: job.kind,
          turnId: job.turnId,
        });
        if (to.threadId) inspectCodex(to, desktops.get(to.id));
      } catch (e) {
        job.status = "delivery_unknown";
        job.error = e.message;
        save();
        log("delivery_unknown", { id: job.id, error: e.message });
      }
    }
  } finally {
    flushBusy = false;
  }
}
async function pollGrok(contact) {
  try {
    const r = await grok([
      "thread",
      contact.botId,
      "--gateway",
      "--limit",
      "80",
      "--no-history",
    ]);
    if (r.target?.id !== contact.botId) throw Error("Bot identity mismatch");
    const entries = r.transcript?.entries || [];
    state.routes[contact.id] = {
      status: "online",
      lastReadAt: new Date().toISOString(),
    };
    if (!state.seen[contact.id]) {
      state.seen[contact.id] = entries.map((e) => e.id);
      save();
      return;
    }
    for (const id of reconcileIdentities(
      state.jobs,
      contact.id,
      entries,
      contact.kind === "group",
    )) {
      log("grok_identity_confirmed", { id });
      save();
    }
    for (const e of entries) {
      const text = e.message?.content;
      const incoming = state.jobs.find(
        (j) => j.to === contact.id && matchesReply(j, e),
      );
      const recoverReply =
        incoming?.kind === "message" &&
        e.kind === "send-message" &&
        !(incoming.handledEntries || []).includes(e.id) &&
        !state.jobs.some((j) => j.id === "reply:" + incoming.id + ":" + e.id);
      if (seen(contact.id, e.id) && !recoverReply) continue;
      if (
        e.kind === "send-message" &&
        typeof text === "string" &&
        text.trim()
      ) {
        if (
          incoming?.kind === "message" &&
          ["waiting_reply", "answered"].includes(incoming.status)
        ) {
          responseTo(incoming, text, e.id);
        } else if (!incoming || incoming.kind !== "message") {
          handleOutgoing(contact.id, text, contact.id + ":" + e.id);
        }
      }
      mark(contact.id, e.id);
      save();
    }
  } catch (e) {
    state.routes[contact.id] = { status: "unavailable", error: e.message };
    save();
    log("grok_unavailable", { id: contact.id, error: e.message });
  } finally {
    nextPoll.set(contact.id, Date.now() + 30000);
  }
}
const inbox = path.join(root, "inbox");
fs.mkdirSync(inbox, { recursive: true });
function ingest() {
  for (const file of fs.readdirSync(inbox).filter((f) => f.endsWith(".json"))) {
    const p = path.join(inbox, file);
    const item = JSON.parse(fs.readFileSync(p, "utf8"));
    findContact(item.to);
    if (item.from !== "bridge") findContact(item.from);
    enqueue(item.from, item.to, item.text, item.id, item.kind);
    fs.unlinkSync(p);
  }
}
for (const j of state.jobs)
  if (j.status === "sending") {
    j.status = "delivery_unknown";
    j.error = "Worker restarted during submission; not automatically resent";
  }
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});
(async () => {
  log("started", { pid: process.pid });
  save();
  try {
    while (running && !fs.existsSync(stopPath)) {
      ingest();
      for (const c of contacts.codex) {
        const d = desktops.get(c.id);
        if (!d || d.problem) await connectDesktop(c);
        else inspectCodex(c, d);
      }
      if (!pollBusy) {
        const c = contacts.grok.find(
          (c) => Date.now() >= (nextPoll.get(c.id) || 0),
        );
        if (c) {
          pollBusy = true;
          pollGrok(c).finally(() => {
            pollBusy = false;
          });
        }
      }
      await flush();
      if (Date.now() - lastSave > 10000) save();
      await new Promise((r) => setTimeout(r, 500));
    }
  } finally {
    running = false;
    for (const d of desktops.values()) d.close();
    while (pollBusy || flushBusy) await new Promise((r) => setTimeout(r, 100));
    save();
    if (
      fs.existsSync(lockPath) &&
      Number(fs.readFileSync(lockPath, "utf8")) === process.pid
    )
      fs.unlinkSync(lockPath);
    if (fs.existsSync(stopPath)) fs.unlinkSync(stopPath);
    log("stopped");
  }
})().catch((e) => {
  log("fatal", { error: e.message });
  process.exitCode = 1;
});
