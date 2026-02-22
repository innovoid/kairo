# Electron Visual Testing

This project now includes an Electron visual smoke suite driven by Playwright.

## Why this approach

The implementation follows the official Electron + Playwright pattern:
- Launch Electron directly and control the first `BrowserWindow`.
- Drive keyboard flows (`Cmd/Ctrl` shortcuts).
- Capture screenshot snapshots and compare for regressions.

Primary references:
- Playwright Electron API: https://playwright.dev/docs/api/class-electron
- Playwright visual snapshot assertions: https://playwright.dev/docs/test-snapshots
- Electron testing overview: https://www.electronjs.org/docs/latest/tutorial/automated-testing

## Test mode

A deterministic renderer test mode is enabled via `?e2e=1`:
- `AuthGate` bypasses login
- `WorkspaceGate` bypasses workspace bootstrapping
- `TerminalCentricAppShell` seeds a synthetic workspace id

This is used only for E2E tests so visual snapshots can run consistently in CI.

## Commands

Run visual suite:

```bash
npm run test:e2e:electron
```

Update baseline screenshots:

```bash
npm run test:e2e:visual:update
```

## Current coverage

`tests/electron/visual-smoke.spec.ts` currently verifies:
- shell render
- command palette open (`Cmd/Ctrl+K`)
- host browser open (`Cmd/Ctrl+H`)
- settings overlay open (`Cmd/Ctrl+,`)

These are true end-to-end Electron flows (main + preload + renderer) and can be extended with additional A-to-Z workflows.

