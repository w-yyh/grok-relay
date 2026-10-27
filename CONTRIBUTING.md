# Contributing

Start with the problem and a minimal reproduction. Use fictional contacts and never include tokens, personal workspaces or real chat logs in an issue, patch or screenshot.

## Local development

Use Windows, Node.js 22.19+, PowerShell 7 and Go 1.25+ for the optional native host.

```powershell
npm ci --ignore-scripts
$env:BRIDGE_DATA_DIR = Join-Path $PWD 'work\dev-data'
npm test
npm run panel
```

The data directory above is disposable. Do not connect daily conversations to a development worker unless their operator explicitly intends that test. `npm run panel` is the web development surface, not a second agent session.

## Before a pull request

- Run `npm test`, `npm run format:check` and `npm run check:release`.
- Run `npm run format` for JavaScript, JSON, HTML, CSS and documentation; use `gofmt` for Go.
- Build with `npm run build:desktop` when changing native code or embedded UI.
- Describe the user-visible change, relevant validation and remaining limits. Do not claim native behavior from a compiler result alone.
- Keep English as the default interface and documentation language; retain Unicode payload support.

CLI stdout must remain machine-readable for JSON commands. Avoid changing delivery semantics or adding business approval policy in the relay. Tests should cover observable behavior, especially busy threads, disconnects, correlation, restarts and uncertain submissions.

Native acceptance includes tray open/close, focus loss, repeated window creation, different DPI settings and process-tree memory measurements. Avoid counting only the main executable.

## Release process

1. Update the package version, changelog and compatibility evidence.
2. Run offline checks and the Windows build. Review the staged diff and the export file list.
3. Export with `pwsh -File scripts/export-source.ps1 -Destination <new-absolute-zip-path>`.
4. Review the actual archive. Never zip a running installation or include `.lnk`, local configs, account files, transcripts, logs or real conversation images.
5. Publish an explicitly labeled prerelease until the native acceptance items are complete.

The repository does not auto-publish releases. CI has read-only repository permissions. Public issues and PRs should contain only the information needed to reproduce the problem.
