# Testing Guide

## Prerequisites
- Install dependencies: `npm install`
- For Electron E2E tests, build artifacts are required.

## Test Commands
- Run all unit/integration tests once: `npm run test:run`
- Run tests in watch mode: `npm test`
- Run UI test runner: `npm run test:ui`
- Run type checks: `npm run typecheck`
- Run Supabase pgTAP DB tests: `npm run test:db`
- Run Electron E2E suite: `npm run test:e2e:electron`
- Run targeted Electron workflow tests: `npm run test:e2e:workflow`
- Update visual snapshots: `npm run test:e2e:visual:update`

## Targeted Test Runs
Use Vitest file filtering for fast iteration:

```bash
npm run test:run -- src/renderer/src/stores/__tests__/agent-store.test.ts
npm run test:run -- src/main/services/__tests__/agent-command-policy.test.ts
```

## Test Layout
- Renderer tests: `src/renderer/src/**/__tests__/*.test.ts(x)`
- Main process tests: `src/main/**/__tests__/*.test.ts`
- Preload contract tests: `src/preload/**/__tests__/*.test.ts`
- E2E tests: `tests/e2e/**`

## Mocking Conventions
- Use `vi.mock(...)` at the top of test files for module mocks.
- For preload APIs, mock `window.*Api` shape exactly as exposed in preload.
- Prefer focused behavior assertions over snapshot-only checks.

## Flake Reduction
- Prefer `findBy*` / `waitFor` for async UI updates.
- Avoid fixed sleeps where possible.
- Keep test timeouts explicit for known long async flows.

## CI-Equivalent Local Check
Run this before opening a PR:

```bash
npm run typecheck
npm run test:run
```

## Supabase Database Tests
- The pgTAP tests live in `supabase/tests/*.sql`.
- Ensure Docker is running for local Supabase.
- Start local stack when needed: `npx supabase start`
- Run DB tests: `npm run test:db`
