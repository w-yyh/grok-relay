# Changelog

## 0.1.0-alpha.1 — 2026-10-27

First public preview.

- Explicit two-way messages between existing Codex desktop threads and Grok Bot agents.
- Compact sender/type headers, persistent queue, correlated replies and busy-thread queuing.
- Agent-oriented JSON CLI, prerequisite checks and distributable skill.
- English interface and documentation with fictional setup examples.
- Optional Wails tray host with lazy window creation and idle panel disposal.
- Offline automated tests and Windows CI; no desktop account required for CI.

The adapters depend on internal or non-officially-stable interfaces. The native shell is a preview; complete native interaction, DPI and process-tree memory acceptance remain pending. See `docs/COMPATIBILITY.md`.
