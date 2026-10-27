# Working on GrokRelay

GrokRelay routes explicit messages between existing desktop conversations. It does not create replacement agent sessions or decide business approvals.

- Read `README.md` for the product boundary and `docs/ARCHITECTURE.md` for the transport flow.
- To **use** the relay as an agent, read `docs/AGENT_GUIDE.md` or the distributable `skills/grok-relay/SKILL.md`. This file is for repository contributors.
- Keep the default interface and primary documentation in English. Examples must use fictional contacts and projects.
- Use `BRIDGE_DATA_DIR` pointing to disposable test data. Never run integration tests against someone's daily conversations without their authorization.
- Run `npm test` and `npm run format:check` after behavioral changes. Build the Windows host for native changes. CI must not require desktop accounts.
- Keep CLI stdout machine-readable for JSON commands; errors go to stderr with a nonzero exit code. Do not expose login tokens through diagnostics.
- Preserve the compact message contract and conservative uncertain-delivery behavior. Do not silently resend an ambiguous submission.
- Do not commit local configs, transcripts, logs, shortcuts, screenshots from real conversations, binaries or build caches. Run `npm run check:release` before publishing.
- Mark unverified behavior as unverified. A passing build is not an end-to-end desktop test or a memory benchmark.
