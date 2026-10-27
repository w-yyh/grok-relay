# Privacy and local data

GrokRelay keeps contact identities, queued message bodies, reply associations and diagnostics in its local data directory. That directory is not source code and must not be published. The panel also keeps a compose draft in local browser/WebView storage until it is sent or replaced.

The relay is local, but the conversations are not offline: a sent message goes to the corresponding desktop product and its services using the existing account. GrokRelay adds no cloud relay, analytics or telemetry endpoint.

The Windows Grok adapter reads the active desktop account's access token from the desktop's local storage. It uses the current user's DPAPI key to decrypt that token in memory and passes it only to the necessary child transport process. It does not read refresh tokens or save a plaintext token. Run the tool only under the intended signed-in Windows account. The current token-storage format is an internal dependency and may change.

Codex communication uses the existing desktop named pipe. The relay does not modify the application bundle, write conversation databases, operate the Codex UI, or start replacement Codex CLI model sessions.

Before sharing a bug report or a fork:

- Exclude `contacts.json`, `runtime.local.json`, `*.local.json`, `state/`, `.env*`, logs and account storage files.
- Do not share Windows shortcuts, real conversation screenshots or copied operator handouts.
- Use fictional names and projects. Replace real thread/bot IDs and local paths.
- Check diffs and release artifacts, not just `.gitignore`.

The release check enforces a source file allowlist and catches common accidental disclosures. It does not replace a human review of newly added examples or screenshots. Git author identity is controlled separately by each contributor's Git configuration.
