const fs = require("node:fs");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const {
  stateDir,
  contactsFile,
  writeContacts,
  local,
} = require("./config.cjs");
const {
  contacts,
  allContacts,
  findContact,
  directory,
} = require("./communication-core.cjs");
const version = require("./package.json").version;
const lock = path.join(stateDir, "communication.pid");

function livePid() {
  try {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}
function state() {
  const file = path.join(stateDir, "communication.json");
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { jobs: [], routes: {} };
}
function metadata(job) {
  const {
    id,
    from,
    to,
    kind,
    status,
    error,
    createdAt,
    deliveredAt,
    answeredAt,
    replyTo,
  } = job;
  return {
    id,
    from,
    to,
    kind,
    status,
    error,
    createdAt,
    deliveredAt,
    answeredAt,
    replyTo,
  };
}
function parseOptions(args) {
  const values = {};
  const flags = new Set(["json", "include-text"]);
  const valued = new Set(["query", "to", "from", "file", "message", "id"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || (!flags.has(key) && !valued.has(key)))
      throw Error("Unknown argument: " + args[i]);
    if (values[key] !== undefined) throw Error("Duplicate option: --" + key);
    if (flags.has(key)) values[key] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith("--"))
        throw Error("Missing value for --" + key);
      values[key] = args[++i];
    }
  }
  return values;
}
function doctor() {
  let powershell = false;
  try {
    execFileSync(
      process.env.BRIDGE_POWERSHELL || local.powershell || "pwsh.exe",
      ["-NoLogo", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"],
      { windowsHide: true, timeout: 5000, stdio: "pipe" },
    );
    powershell = true;
  } catch {}
  const checks = {
    windows: process.platform === "win32",
    powershell,
    grokClient: fs.existsSync(
      process.env.BRIDGE_GROK_CLI ||
        local.grokCli ||
        path.join(__dirname, "node_modules/grok-bot-cli/dist/bin/gbot.mjs"),
    ),
    grokDesktopFiles:
      !!process.env.APPDATA &&
      ["sand-secrets.json", "Local State", "desktop-status.json"].every(
        (name) =>
          fs.existsSync(path.join(process.env.APPDATA, "Grok Bot", name)),
      ),
    contactsConfigured: allContacts.length > 0,
  };
  return {
    version,
    ready: Object.values(checks).every(Boolean),
    checks,
    workerRunning: !!livePid(),
    note: "Checks file availability only. No credentials are read and no network requests are made.",
  };
}

async function run(args = process.argv.slice(2)) {
  const command = args.shift();
  const output = (value) => console.log(JSON.stringify(value, null, 2));
  if (!command || ["help", "--help", "-h"].includes(command)) {
    console.log(
      `GrokRelay ${version}\n\nUsage: node bridge.cjs <command> [options]\n\n  init --file FILE                 Register an initial contact configuration\n  contacts [--query TEXT] [--json] Find registered recipients\n  discover grok [--json]           List Grok Bot IDs and names\n  doctor [--json]                  Check local prerequisites without reading tokens\n  start | stop | status           Control the relay; JSON output\n  send --to ADDRESS [--from ADDRESS] --file FILE\n  send --to ADDRESS [--from ADDRESS] --message TEXT\n  message --id ID [--include-text] Inspect one message and its replies\n\nOnly explicit messages are forwarded. See docs/AGENT_GUIDE.md.`,
    );
    return;
  }
  if (command === "--version") {
    console.log(version);
    return;
  }
  let discover;
  if (command === "discover") discover = args.shift();
  const options = parseOptions(args);
  if (command === "contacts") {
    const query = (options.query || "").toLowerCase();
    const rows = allContacts.filter((c) =>
      [c.id, c.name, ...c.aliases, c.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
    if (options.json)
      output(
        rows.map(({ id, name, aliases, description }) => ({
          id,
          name,
          aliases,
          description,
        })),
      );
    else console.log(directory(options.query || ""));
    return;
  }
  if (command === "discover") {
    if (discover !== "grok")
      throw Error(
        "Only discover grok is supported. Copy Codex thread links from the desktop app.",
      );
    const result = await require("./grok-existing-session.cjs").grok([
      "bots",
      "list",
      "--gateway",
    ]);
    if (!Array.isArray(result))
      throw Error("Unexpected bot-list response; adapter update required");
    output(result.map((b) => ({ botId: b.id, name: b.name })));
    return;
  }
  if (command === "doctor") {
    const result = doctor();
    output(result);
    if (!result.ready) process.exitCode = 1;
    return;
  }
  if (command === "init") {
    if (!options.file) throw Error("Use init --file CONTACTS_FILE");
    if (fs.existsSync(contactsFile))
      throw Error(
        "Contacts already exist. Edit them in the panel or stop the worker before editing the data file.",
      );
    writeContacts(
      JSON.parse(fs.readFileSync(path.resolve(options.file), "utf8")),
    );
    output({ initialized: true });
    return;
  }
  if (command === "start") {
    if (process.platform !== "win32")
      throw Error("Desktop adapters currently support Windows only");
    if (livePid()) {
      output({ running: true, pid: livePid() });
      return;
    }
    fs.mkdirSync(stateDir, { recursive: true });
    const log = fs.openSync(path.join(stateDir, "worker.log"), "a");
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "communication-worker.cjs")],
      {
        cwd: __dirname,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", log, log],
      },
    );
    child.unref();
    fs.closeSync(log);
    await new Promise((r) => setTimeout(r, 1800));
    if (!livePid())
      throw Error("Worker did not start. Inspect the local state/worker.log.");
    output({ running: true, pid: livePid() });
    return;
  }
  if (command === "stop") {
    if (!livePid()) {
      output({ running: false });
      return;
    }
    fs.writeFileSync(path.join(stateDir, "communication.stop"), "stop");
    output({ stopRequested: true, pid: livePid() });
    return;
  }
  if (command === "status") {
    const s = state();
    output({
      running: !!livePid(),
      updatedAt: s.updatedAt,
      routes: s.routes,
      jobs: s.jobs.map(metadata),
    });
    return;
  }
  if (command === "message") {
    if (!options.id) throw Error("Use message --id ID");
    const s = state();
    let job = s.jobs.find((j) => j.id === options.id);
    const queued = path.join(
      stateDir,
      "inbox",
      path.basename(options.id) + ".json",
    );
    if (!job && fs.existsSync(queued))
      job = {
        ...JSON.parse(fs.readFileSync(queued, "utf8")),
        status: "queued",
      };
    if (!job) throw Error("Message not found");
    const view = (j) => ({
      ...metadata(j),
      ...(options["include-text"] ? { text: j.text } : {}),
    });
    output({
      message: view(job),
      replies: s.jobs.filter((j) => j.replyTo === job.id).map(view),
    });
    return;
  }
  if (command === "send" || command === "notice") {
    const to = findContact(options.to || "");
    const source =
      options.from ||
      contacts.codex.find((c) => c.threadId === process.env.CODEX_THREAD_ID)
        ?.id;
    if (command === "send" && !source)
      throw Error("Specify --from or run inside a registered Codex thread");
    const from = command === "notice" ? "bridge" : findContact(source).id;
    if (from === to.id) throw Error("Sender and recipient must differ");
    if (options.file && options.message)
      throw Error("Use either --file or --message, not both");
    const text = options.file
      ? fs.readFileSync(path.resolve(options.file), "utf8")
      : options.message;
    if (!text?.trim())
      throw Error("Provide a non-empty UTF-8 --file or --message");
    if (Buffer.byteLength(text) > 200000)
      throw Error("Message exceeds 200,000 UTF-8 bytes");
    const id = randomUUID(),
      inbox = path.join(stateDir, "inbox");
    fs.mkdirSync(inbox, { recursive: true });
    const temp = path.join(inbox, id + ".tmp");
    fs.writeFileSync(
      temp,
      JSON.stringify({
        id,
        from,
        to: to.id,
        text,
        kind: command === "notice" ? "notice" : "message",
      }),
    );
    fs.renameSync(temp, path.join(inbox, id + ".json"));
    output({
      id,
      from,
      to: to.id,
      status: "queued",
      workerRunning: !!livePid(),
    });
    return;
  }
  throw Error("Unknown command: " + command);
}
module.exports = { run, parseOptions, metadata };
