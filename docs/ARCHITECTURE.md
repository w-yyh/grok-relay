# Architecture

![Conceptual message flow](assets/message-flow.svg)

This diagram illustrates data flow; it is not a screenshot or evidence of a specific user's setup.

1. An agent emits a standalone send envelope, or a shell-capable agent submits through `bridge.cjs`.
2. The worker resolves the recipient from the local directory and persists a queue item.
3. The Codex adapter discovers the existing desktop owner and subscribes to its state. It steers an active turn immediately or starts a turn when idle, for messages and replies alike. The Grok adapter sends to the existing bot through its gateway transport. Independent destinations can progress concurrently, preserving submission order per destination.
4. Replies are associated with the destination turn/request, persisted and delivered back once. A reply acknowledgment is not recursively forwarded.

`message-format.cjs` separates display text from queue metadata. When Grok returns acceptance without a request ID, the worker matches submitted text and time to a user transcript entry, allowing CRLF conversion and trailing-newline removal. Groups correlate replies within the observed group turn. Multiple identical submissions consume distinct entries. `delivery.cjs` recovers Codex acknowledgments from observed user items after a timeout, using the client message ID or exact text/time evidence. A missing acknowledgment does not cause blind retransmission.

`registration.cjs` accepts verified identities through a single-worker registration inbox. Codex supplies its current thread identity via the CLI; unknown Grok conversations can explicitly opt in using a registration envelope. Discovery reads account contact metadata and a small recent transcript tail, processes only registration commands, and does not retain unregistered chat bodies. Registration establishes a history baseline without dropping messages posted immediately afterward. Contacts hot-reload in the worker.

The optional Go/Wails host embeds the public interface, provides native tray/window controls, and forwards its local API requests to the Node panel service. The worker is independent of the window. WebViews are created on demand; a hidden tray panel is closed after eight seconds. The persistent window is released on close. No bundled Chromium distribution or frontend framework is required.

## Source map

| Path                         | Responsibility                                              |
| ---------------------------- | ----------------------------------------------------------- |
| `bridge.cjs`, `cli.cjs`      | Agent/operator commands and machine-readable receipts       |
| `config.cjs`                 | Contact configuration and data paths                        |
| `communication-worker.cjs`   | Polling, queue state, routing and correlated replies        |
| `registration.cjs`           | Verified registration requests and history baselines        |
| `delivery.cjs`               | Timeout reconciliation and fair contact polling             |
| `communication-core.cjs`     | Envelope parsing and desktop thread state                   |
| `codex-desktop-ipc.cjs`      | Existing desktop pipe transport                             |
| `grok-existing-session.cjs`  | Current-user Grok login adaptation and transport invocation |
| `panel-server.cjs`, `panel/` | Local HTTP API and English interface                        |
| `desktop/`, `assets.go`      | Optional Wails host and embedded public assets              |

No business approval rules or task-selection policy belong in the relay. Each endpoint keeps its own context, instructions and capabilities.
