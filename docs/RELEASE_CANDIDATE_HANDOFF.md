# Glow Logic Release Candidate Handoff

This document is the release-candidate handoff for the current Glow Logic refactor. It summarizes what should be true before handing the app to another agent, a human tester, or a show operator.

## Current Gate

Run the non-browser release gate:

```bash
npm run release:check
```

Expected result:

- TypeScript: pass
- ESLint web: pass
- Web unit tests: pass
- API smoke: pass
- Field smoke: pass
- Diff whitespace: pass

The command writes a local Markdown report under `reports/field/`. Those generated reports are ignored by git.

## Optional Gate

Run this only on a machine allowed to spawn browser/build workers:

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/Run-ReleaseCandidateChecks.ps1 -IncludeBuild -IncludeUi -IncludeTtfl
```

Optional checks:

- `npm run build`
- `npm run test:visual`
- `npm run test:show`
- `npm run field:ttfl`

Known local blocker: in the Codex Windows sandbox, `next build` compiles successfully and then fails on `spawn EPERM`. Playwright workers can hit the same class of permission failure.

If this happens, run:

```bash
npm run doctor:eperm
```

Then read `docs/WINDOWS_EPERM_DIAGNOSTIC.md`.

## Manual Field Ritual

Generate a blank human report:

```bash
npm run field:report
```

Then follow:

- `docs/FIELD_VALIDATION.md`
- `docs/spec-smart/03-DISCIPLINE.md`

The release is not field-ready until the "Show from scratch" ritual is completed and TTFL is recorded.

## What Is Covered

Automated coverage currently includes:

- API auth bootstrap and bearer protection
- fixture save/load/import profile flow
- library export/import and CRUD smoke
- safety status, validation, and blocked dangerous show actions
- DMX router output status
- `.glowproject` export/import package roundtrip
- offline backup unit behavior
- DMX offline queue unit behavior
- trajectory generation unit behavior
- field pre-show smoke without Playwright

## Known Environment Blockers

- `npm run build`: Next.js production compile succeeds, then the sandbox can block a child process with `spawn EPERM`.
- `npm run test:visual` and `npm run test:show`: require Playwright worker/browser launch permissions.
- `npm run field:ttfl`: needs local API/web services running, or use `Measure-TTFL.ps1 -StartServices`.
- `npm run doctor:eperm`: writes a local diagnostic report for the permission issue.

## Handoff Commands

Use these in order:

```bash
npm run release:check
npm run field:report
npm run field:ttfl
npm run build
```

If build or UI tests are blocked by permissions, record the exact error in the generated field report instead of marking the release clean.

## Release Decision Template

- Automated gate: `PASS / FAIL`
- Build: `PASS / FAIL / EPERM blocked`
- UI automation: `PASS / FAIL / EPERM blocked / not run`
- Manual show-from-scratch: `PASS / FAIL / not run`
- TTFL preview: `__ min __ s`
- TTFL hardware: `__ min __ s / N/A`
- Decision: `PASS / RETEST / BLOCKED`

## Next Owner Notes

- Do not bypass the server safety gate for AI, MIDI, API, or timeline actions.
- Do not change the DMX engine cadence from 44 Hz.
- Do not treat generated reports in `reports/field/` as source files.
- Do not claim a clean build if `spawn EPERM` occurred after Next compilation.
