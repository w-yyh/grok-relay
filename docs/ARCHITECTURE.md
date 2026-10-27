# Architecture

![Conceptual message flow](assets/message-flow.svg)

This diagram illustrates data flow; it is not a screenshot or evidence of a specific user's setup.

1. An agent emits a standalone send envelope, or a shell-capable agent submits through `bridge.cjs`.
2. The worker resolves the recipient from the local directory and persists a queue item.
3. The Codex adapter discovers the existing desktop owner, subscribes to the thread state and starts the next turn only when idle. The Grok adapter sends to the existing bot through its gateway transport.
4. Replies are associated with the destination turn/request, persisted and delivered back once. A reply acknowledgment is not recursively forwarded.

`message-format.cjs` separates display text from queue metadata. When Grok returns acceptance without a request ID, the worker matches the actual submitted text and time to a user transcript entry, then uses its request ID. Multiple identical submissions consume distinct matching entries.

The optional Go/Wails host embeds the public interface, provides native tray/window controls, and forwards its local API requests to the Node panel service. The worker is independent of the window. WebViews are created on demand; a hidden tray panel is closed after eight seconds. The persistent window is released on close. No bundled Chromium distribution or frontend framework is required.

## Source map

| Path                         | Responsibility                                              |
| ---------------------------- | ----------------------------------------------------------- |
| `bridge.cjs`, `cli.cjs`      | Agent/operator commands and machine-readable receipts       |
| `config.cjs`                 | Contact configuration and data paths                        |
| `communication-worker.cjs`   | Polling, queue state, routing and correlated replies        |
| `communication-core.cjs`     | Envelope parsing and desktop thread state                   |
| `codex-desktop-ipc.cjs`      | Existing desktop pipe transport                             |
| `grok-existing-session.cjs`  | Current-user Grok login adaptation and transport invocation |
| `panel-server.cjs`, `panel/` | Local HTTP API and English interface                        |
| `desktop/`, `assets.go`      | Optional Wails host and embedded public assets              |

No business approval rules or task-selection policy belong in the relay. Each endpoint keeps its own context, instructions and capabilities.
