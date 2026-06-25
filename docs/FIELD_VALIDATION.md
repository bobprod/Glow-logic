# Glow Logic Field Validation

This checklist is the human validation ritual for a release candidate. It complements automated checks; it does not replace them.

## Before The Test

- Machine: `________________`
- Date: `________________`
- Operator: `________________`
- Build or branch: `________________`
- Hardware mode: `Preview 3D / Real DMX`
- Controller: `APC mini / Keyboard / Other: ________________`

## Automated Gate

Run these before the manual flow:

```bash
npm run release:check
npm run typecheck --workspaces
npm run lint --workspace web
npm run test:unit --workspace web
npm run test:api
npm run test:field
npm run field:ttfl
```

Record result:

- TypeScript: `PASS / FAIL`
- Lint: `PASS / FAIL`
- Unit tests: `PASS / FAIL`
- API smoke: `PASS / FAIL`
- Field smoke: `PASS / FAIL`
- TTFL report path: `________________`
- Build: `PASS / FAIL / EPERM blocked`

## Show From Scratch

Start a stopwatch at launcher click. Stop the TTFL stopwatch when one real fixture, or the 3D preview, responds to an intensity fader.

| Step | Expected Result | Status | Notes |
|---|---|---|---|
| Launch app | Launcher opens API + Web, Smart/Perform reachable | `PASS / FAIL` | |
| Patch fixtures | 4 PAR LED + 2 moving heads exist in the patch | `PASS / FAIL` | |
| Place fixtures | Fixtures appear on the stage plan and keep positions after save/reload | `PASS / FAIL` | |
| Create pads | 8 scene pads exist on page 1: 2 colors, 1 strobe, 1 blackout, 4 free | `PASS / FAIL` | |
| Map controls | 2 pads + 1 group fader are mapped to controller/keyboard | `PASS / FAIL` | |
| Move fixture | Selecting a moving head opens inspector; XY movement affects preview/fixture | `PASS / FAIL` | |
| Record automation | 10 s XY movement records into timeline and plays back | `PASS / FAIL` | |
| Save project | Project saves with pads, mappings, positions, timeline | `PASS / FAIL` | |
| Restart app | Full close/relaunch works; project reloads intact | `PASS / FAIL` | |
| DMX failure visible | Cutting a DMX output makes the DMX badge red within 5 s | `PASS / FAIL / N/A` | |

## TTFL Result

- Preview target: `< 3 min`
- Hardware target: `< 10 min`
- Measured TTFL: `__ min __ s`
- Result: `PASS / FAIL`

## Release Decision

- Decision: `PASS / FAIL / RETEST`
- Blocking issues:
  - `________________________________`
  - `________________________________`
- Follow-up issues:
  - `________________________________`
  - `________________________________`

## Notes

Write every friction immediately. No mental notes.
