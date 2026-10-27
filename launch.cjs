const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const executable = path.join(__dirname, "GrokRelay.exe");
if (!fs.existsSync(executable)) {
  console.error(
    "Build the desktop shell with npm run build:desktop first. Use npm run panel for web development.",
  );
  process.exitCode = 1;
} else {
  const child = spawn(executable, process.argv.slice(2), {
    cwd: __dirname,
    env: { ...process.env, BRIDGE_NODE: process.execPath },
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.unref();
}
