# Setup

## Group conversations

A Grok Bot private chat and a group containing that bot have separate transcripts. To route messages from a group, register the group itself: `node bridge.cjs discover groups --json`, then **Contacts → Add contact → Grok Bot group**. Use a distinct address such as `grok:research-team`. JSON configurations use the group's ID in `botId` and `kind: "group"`. Replies return to the source group. Registering a bot alone does not subscribe to all of its groups.

## Requirements

- Windows with Codex Desktop and Grok Bot already installed and signed in.
- Node.js **22.19 or later** and PowerShell **7** on PATH.
- For the optional native host: system WebView2 Runtime. Building it needs Go **1.25 or later**; the local preview build used Go 1.27.3.
- Same Windows user as the signed-in Grok Bot desktop account.

No separate model API key is required by GrokRelay. Messages still use the existing products' accounts, connectivity, permissions and quotas.

## Install the relay

```powershell
git clone https://github.com/w-yyh/grok-relay.git
cd grok-relay
npm ci --ignore-scripts
```

The first public version is an alpha, not an official Codex or Grok Bot extension. Read [compatibility](COMPATIBILITY.md) before connecting important work.

## Register contacts

Start from `contacts.example.json`, which is intentionally empty. A configuration has this shape; **every value below is fictional**:

```json
{
  "version": 1,
  "codex": [
    {
      "id": "codex:website",
      "name": "Website developer",
      "threadId": "REPLACE_WITH_REAL_THREAD_ID",
      "hostId": "local",
      "cwd": "C:\\Projects\\example-site",
      "aliases": ["developer"]
    }
  ],
  "grok": [
    {
      "id": "grok:writer",
      "name": "Content writer",
      "botId": "REPLACE_WITH_REAL_BOT_ID",
      "aliases": ["writer"]
    }
  ]
}
```

Copy the Codex thread link from the desktop app. Its form is `codex://threads/<thread-id>`; use the ID portion in JSON, or paste the complete link in the panel. The workspace must match that thread's actual workspace. Open that existing thread in Codex so its desktop owner is available.

To list existing Grok Bot IDs with the active desktop login:

```powershell
node bridge.cjs discover grok --json
```

This live request returns bot names and IDs locally. Do not paste the output into public issues. It does not create bots or conversations.

Save your completed configuration **outside this repository**, then initialize it once:

```powershell
node bridge.cjs init --file C:\path\to\contacts.json
node bridge.cjs doctor --json
node bridge.cjs start
node bridge.cjs status
```

`init` refuses to overwrite an existing address book. Later edits can use the panel, or you can stop the worker and edit the data file manually. Do not reassign an existing address to a different identity while it has pending work.

## Introduce the bridge to agents

Give each participant its own address, the intended recipients' addresses, and [the agent guide](AGENT_GUIDE.md). Shell-capable agents can use the JSON CLI. Agents without shell access can emit the standalone envelope described there. Merely adding a contact does not teach a model how to use the protocol.

Use a harmless handshake in dedicated test conversations first. Check both original windows. The first connection establishes a baseline and does not replay old conversation history.

## Optional native tray interface

```powershell
npm run build:desktop
npm start
# Or start with only a tray icon:
node launch.cjs --tray
```

The desktop shell uses Wails and the system WebView2 runtime. The panel opens from the tray; composing, editing contacts and reading full messages use a separate window. Closing the window leaves the relay available. **Quit GrokRelay** stops the relay. No login-start registration is installed.

The native host is currently a preview. See the explicit verification table in [COMPATIBILITY.md](COMPATIBILITY.md).

## Data and overrides

By default, data lives in `%LOCALAPPDATA%\GrokRelay`, separate from source code:

- `contacts.json`: real identities and aliases.
- `state/communication.json`: queue, text bodies and reply associations.
- `state/inbox/`: submissions waiting for ingestion.
- `state/*.log`: runtime diagnostics.
- `state/webview2/`: local interface storage, including a saved compose draft.

| Variable            | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `BRIDGE_DATA_DIR`   | Isolated data directory; use a disposable one for tests      |
| `BRIDGE_GROK_CLI`   | Absolute path to an existing `gbot.mjs`                      |
| `BRIDGE_POWERSHELL` | PowerShell 7 executable; default `pwsh.exe`                  |
| `BRIDGE_NODE`       | Node executable for the native host; `npm start` supplies it |
| `BRIDGE_PORT`       | Local panel port; default `43187`                            |

An ignored `runtime.local.json` may set `dataDir`, `grokCli` and `powershell`. It is a private local override, not a distributable configuration.

## Troubleshooting

| Symptom                          | Check                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| Empty contact list               | Initialize the configuration in the same data directory as the worker                     |
| `grokClient: false`              | Check the optional `grok-bot-cli` installation; npm may skip a failed optional dependency |
| `grokDesktopFiles: false`        | Run under the same Windows user as Grok Bot; ensure it has been signed in                 |
| Codex route unavailable          | Open the exact existing thread and check its workspace                                    |
| Grok unavailable after an update | Compare app versions with the compatibility table; do not export tokens to debug          |
| Message stays queued             | Check `running` and recipient route status; busy Codex threads wait                       |
| `delivery_unknown`               | Inspect the destination before retrying; automatic retries are intentionally avoided      |
| Native build fails               | Confirm Go and PowerShell 7 are on PATH; use the relay without the optional GUI meanwhile |

For development only, `npm run panel` serves the interface at `http://127.0.0.1:43187`. Avoid running multiple installations against the same data directory.
