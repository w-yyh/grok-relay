# Compatibility and verification

GrokRelay is an **early Windows preview**. A maintained repository structure does not make private desktop interfaces stable APIs.

| Component        | Observed version | Verification                                                             |
| ---------------- | ---------------- | ------------------------------------------------------------------------ |
| Codex Desktop    | 26.1021.3705.0   | Existing-thread messaging and correlated final replies exercised locally |
| Grok Bot Desktop | 0.77.0           | Existing-bot messaging and transcript correlation exercised locally      |
| grok-bot-cli     | 0.12.4           | Used by the Grok adapter; pinned dependency                              |
| Node.js          | 24.15.0          | Local development and tests                                              |
| Wails            | 3.0.0-beta.24    | Native window and language switch exercised; broader acceptance pending  |
| Go               | 1.27.3           | Local Windows host build                                                 |

## What has been checked

- Real two-way text exchanges remained visible in the original desktop conversations.
- Compact headers and reply association were checked against original messages.
- Busy-thread queuing and restart without duplicate known messages were exercised locally.
- The web interface's empty state, contact CRUD, start/stop and message submission were exercised.
- The installed native window, English/Chinese language setting and Windows icon resources were checked locally. Closing windows released their WebView processes while the worker continued running.
- An explicitly registered Grok group delivered a real envelope into an existing Codex thread; a notice sent back to the group was confirmed in its transcript. Group reply association has automated coverage; broader multi-member workflows remain under trial.
- Automated tests exercise parsing, Unicode payloads, contact validation, CLI receipts, local HTTP behavior and interrupted IPC requests.

These are development observations, not a guarantee for every installation. No private evidence, customer names or real conversation screenshots are included in this repository.

## Pending acceptance

Native tray expand/collapse, lifecycle after repeated opens, different DPI settings, complete process-tree memory measurements, and a clean-machine installer have not been fully accepted. Do not advertise a fixed RAM budget or production readiness based on the executable size or a passing compiler.

## Boundaries

- Windows only. Existing local Codex thread owners must be available; there is no remote-host routing.
- Text and links only; attachments are not transferred.
- Grok reads are scheduled 10 seconds after successful reads, with up to 200 recent entries per contact. Account scheduling and network latency extend this interval. Unregistered bots/groups are checked about once per minute for explicit registration only. Long offline periods or high message volume can exceed the transcript window; full historical backfill is not guaranteed.
- The first connection establishes a baseline, rather than forwarding old messages.
- Uncertain sends are not retried automatically. A returned reply may be progress, not task completion.
- The panel displays the latest 200 jobs. Persistent state has no automatic retention policy yet.
- Internal application updates can break adapters. There is no promise of official vendor support or compatibility beyond observed versions.
- No signed installer, automatic updates, OS-login startup registration or cross-device service is included.
