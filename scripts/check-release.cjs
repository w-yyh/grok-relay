const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pkg = require("../package.json");
const forbidden =
  /(^|\/)(state|node_modules|gbot-package|work|outputs)(\/|$)|(^|\/)(contacts\.json|runtime\.local\.json|\.env[^/]*|[^/]*\.lnk|[^/]*\.log|[^/]*\.local\.json|[^/]*\.exe)$/i;
function sourceFiles() {
  const files = new Set();
  const visit = (relative) => {
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep))
      throw Error("Export entry outside project");
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw Error("Symlinks are not release inputs");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target))
        visit(path.join(relative, name));
      return;
    }
    const normalized = relative.split(path.sep).join("/");
    if (forbidden.test(normalized) || /fixture-/.test(normalized))
      throw Error("Private or temporary file in release: " + normalized);
    files.add(normalized);
  };
  for (const entry of [
    ...pkg.files,
    "package.json",
    "package-lock.json",
    ".gitignore",
  ])
    visit(entry);
  return [...files].sort();
}
function checkText(input, file, denylist = []) {
  const text = input.replaceAll("\\\\", "\\");
  if (/[A-Z]:[\\/]Users[\\/](?!Public[\\/])[^\s\\/"'<>]+/i.test(text))
    throw Error("Personal Windows path in " + file);
  if (
    /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{25,}\b/.test(text) ||
    /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text)
  )
    throw Error("Possible credential in " + file);
  if (
    denylist.some(
      (value) =>
        value && text.toLowerCase().includes(String(value).toLowerCase()),
    )
  )
    throw Error("Private identifier in " + file);
}
function check(denylist = []) {
  const files = sourceFiles();
  for (const file of files) {
    if (/\.(png|ico|webp)$/i.test(file)) continue;
    checkText(fs.readFileSync(path.join(root, file), "utf8"), file, denylist);
  }
  const example = JSON.parse(
    fs.readFileSync(path.join(root, "contacts.example.json"), "utf8"),
  );
  if (example.codex.length || example.grok.length)
    throw Error("Default contact template must be empty");
  return { version: pkg.version, files: files.length, sourceOnly: true };
}
if (require.main === module) {
  try {
    const i = process.argv.indexOf("--denylist");
    const denied =
      i >= 0 ? JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8")) : [];
    console.log(JSON.stringify(check(denied)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { sourceFiles, check, checkText };
