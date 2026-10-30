const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const {
  stateDir,
  dataDir,
  readContacts,
  writeContacts,
} = require("./config.cjs");
const { displayName } = require("./message-format.cjs");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function readPreferences() {
  const file = path.join(stateDir, "preferences.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}
function savePreferences(changes) {
  const preferences = { ...readPreferences(), ...changes };
  fs.mkdirSync(stateDir, { recursive: true });
  const file = path.join(stateDir, "preferences.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(preferences));
  fs.renameSync(file + ".tmp", file);
  return preferences;
}
function readState() {
  const file = path.join(stateDir, "communication.json");
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { jobs: [], routes: {} };
}
function workerPid() {
  try {
    const pid = Number(
      fs.readFileSync(path.join(stateDir, "communication.pid"), "utf8"),
    );
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}
async function control(action) {
  if (!["start", "stop", "restart"].includes(action))
    throw Error("Unknown action");
  if (action !== "start") {
    await run(process.execPath, [path.join(__dirname, "bridge.cjs"), "stop"], {
      windowsHide: true,
    });
    const deadline = Date.now() + 70000;
    while (workerPid() && Date.now() < deadline) await delay(250);
    if (workerPid())
      throw Error("A request is still finishing; try again shortly");
  }
  if (action !== "stop")
    await run(process.execPath, [path.join(__dirname, "bridge.cjs"), "start"], {
      windowsHide: true,
    });
}
function snapshot() {
  const state = readState(),
    book = readContacts();
  const contacts = [...book.codex, ...book.grok].map((c) => ({
    ...c,
    shortName: displayName(c),
    platform: c.threadId ? "Codex" : "Grok Bot",
    route: state.routes[c.id] || { status: "unavailable" },
  }));
  return {
    app: "GrokRelay",
    version: require("./package.json").version,
    language: readPreferences().language === "zh-CN" ? "zh-CN" : "en",
    running: !!workerPid(),
    updatedAt: state.updatedAt,
    contacts,
    jobs: state.jobs
      .slice(-200)
      .reverse()
      .map((j) => ({
        id: j.id,
        from: j.from,
        to: j.to,
        text: j.text,
        kind: j.kind,
        status: j.status,
        createdAt: j.createdAt,
        deliveredAt: j.deliveredAt,
        error: j.error,
        replyTo: j.replyTo,
        waitReason: j.waitReason,
      })),
    dataDir,
    pollSeconds: 10,
  };
}
async function body(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 256 * 1024) throw Error("Message too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function enqueue(value) {
  const book = readContacts(),
    contacts = [...book.codex, ...book.grok];
  if (
    !contacts.some((c) => c.id === value.to) ||
    !contacts.some((c) => c.id === value.from)
  )
    throw Error("Select registered contacts");
  if (value.from === value.to) throw Error("Sender and recipient must differ");
  if (typeof value.text !== "string" || !value.text.trim())
    throw Error("A message body is required");
  const id = randomUUID(),
    inbox = path.join(stateDir, "inbox");
  fs.mkdirSync(inbox, { recursive: true });
  const file = path.join(inbox, id + ".tmp");
  fs.writeFileSync(
    file,
    JSON.stringify({
      id,
      from: value.from,
      to: value.to,
      text: value.text.trim(),
      kind: "message",
    }),
  );
  fs.renameSync(file, path.join(inbox, id + ".json"));
  return { id, status: "queued" };
}
function createServer() {
  let changing = false;
  return http.createServer(async (req, res) => {
    const host = req.headers.host;
    const origin = "http://" + host;
    const answer = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const apiRequest = req.url.startsWith("/api/");
    if (
      !/^127\.0\.0\.1:\d+$/.test(host || "") ||
      (apiRequest &&
        ((req.headers.origin && req.headers.origin !== origin) ||
          req.headers["sec-fetch-site"] === "cross-site"))
    )
      return answer(403, { error: "Local panel access only" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(req.url, origin);
      if (req.method === "GET" && url.pathname === "/api/status")
        return answer(200, snapshot());
      if (req.method === "POST") {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return answer(415, { error: "JSON content type required" });
        const value = await body(req);
        if (url.pathname === "/api/send") return answer(202, enqueue(value));
        if (changing)
          return answer(409, {
            error: "Settings are being applied; try again shortly",
          });
        changing = true;
        try {
          if (url.pathname === "/api/preferences") {
            if (!["en", "zh-CN"].includes(value.language))
              throw Error("Unsupported language");
            return answer(200, savePreferences({ language: value.language }));
          }
          if (url.pathname === "/api/control") {
            await control(value.action);
            if (value.remember !== false) {
              savePreferences({ paused: value.action === "stop" });
            }
            return answer(200, snapshot());
          }
          if (url.pathname === "/api/contacts") {
            const ids = new Set(
              [...(value.codex || []), ...(value.grok || [])].map((c) => c.id),
            );
            const active = readState().jobs.filter((j) =>
              [
                "queued",
                "sending",
                "waiting_reply",
                "waiting_identity",
                "delivery_unknown",
              ].includes(j.status),
            );
            if (
              active.some(
                (j) =>
                  !ids.has(j.to) || (j.from !== "bridge" && !ids.has(j.from)),
              )
            )
              throw Error("A contact with pending messages cannot be removed");
            require("./config.cjs").validateContacts(value);
            const wasRunning = !!workerPid();
            if (wasRunning) await control("stop");
            writeContacts(value);
            if (wasRunning) await control("start");
            return answer(200, snapshot());
          }
          return answer(404, { error: "Unknown endpoint" });
        } finally {
          changing = false;
        }
      }
      const files = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/i18n.js": ["i18n.js", "text/javascript"],
        "/logo.svg": ["logo.svg", "image/svg+xml"],
        "/style.css": ["style.css", "text/css"],
      };
      if (req.method !== "GET" || !files[url.pathname])
        return answer(404, { error: "Not found" });
      const [file, type] = files[url.pathname];
      res.writeHead(200, {
        "Content-Type": type + "; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(fs.readFileSync(path.join(__dirname, "panel", file)));
    } catch (error) {
      answer(400, { error: error.message });
    }
  });
}
if (require.main === module) {
  fs.mkdirSync(stateDir, { recursive: true });
  const port = Number(process.env.BRIDGE_PORT || 43187);
  const server = createServer();
  server.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log("GrokRelay http://127.0.0.1:" + port),
  );
}
module.exports = { createServer, snapshot, enqueue, readJsonBody: body };
