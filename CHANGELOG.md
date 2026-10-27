# Changelog

## Unreleased

- Add English / Simplified Chinese interface settings, persisted locally with English as the default.
- Use one original monochrome link logo across the interface, tray, window, Windows executable and shortcuts.
- Explain queued messages waiting for a busy or disconnected Codex thread.
- Expose Grok group discovery and registration; document that groups and private chats are separate endpoints.
- Preserve JSON request bodies when the native WebView proxy receives a stream without a content length, fixing language changes and other panel submissions.
- Embed multi-resolution Windows icon resources during the normal build; no additional runtime dependency.

## 0.1.0-alpha.1 — 2026-10-27

First public preview.

- Explicit two-way messages between existing Codex desktop threads and Grok Bot agents.
- Compact sender/type headers, persistent queue, correlated replies and busy-thread queuing.
- Agent-oriented JSON CLI, prerequisite checks and distributable skill.
- English interface and documentation with fictional setup examples.
- Optional Wails tray host with lazy window creation and idle panel disposal.
- Offline automated tests and Windows CI; no desktop account required for CI.

The adapters depend on internal or non-officially-stable interfaces. The native shell is a preview; complete native interaction, DPI and process-tree memory acceptance remain pending. See `docs/COMPATIBILITY.md`.
