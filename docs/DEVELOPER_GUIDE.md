# Glow Logic Developer Guide

Last updated: 2026-06-10

This guide is for developers extending Glow Logic without breaking the show-control constraints. It describes the current modular architecture, the state model, the real-time DMX path, safety rules, and the verification workflow.

## Core Rules

These rules are not optional:

1. Safety Gate logic is deterministic and server-side. AI, presets, imports, and external APIs must never bypass it.
2. The DMX client engine runs at 44 Hz. Do not change `DmxEngine.FPS` unless the whole timing model is revalidated.
3. New persisted frontend state belongs in a Zustand slice, not scattered localStorage writes.
4. TypeScript must stay strict. Do not introduce `any` in new code when a contract can be expressed.
5. Dangerous physical output remains disabled by policy in the MVP. Simulation can be allowed, physical laser/pyro/drone output is blocked by `safetyGate.ts`.
6. Do not make AI-configurable safety limits. Limits such as laser power and drone geofence are hardcoded.

## Repository Layout

```text
Glow-logic/
  apps/
    web/                 Next.js frontend
      src/
        app/             App routes
        components/      Smart dashboard, patch, timeline, visualizer, settings
        components/three Three.js visualizer and safety simulation
        lib/             Client engines: DMX, faders, effects, sockets, audio
        store/           Zustand root store and modular slices
        types/           Shared frontend TypeScript contracts
    server/              Express + Socket.IO backend
      index.ts           REST API, Socket.IO registration, startup
      services/          Backend services, persistence, integrations
      tests/             API smoke tests
  scripts/               Windows launcher and stop helpers
  docs/                  Advanced developer and API documentation
  memory/                Session notes and implementation history
```

## Frontend Architecture

The frontend is a Next.js app. Most show UI lives under `apps/web/src/components`.

Important entry points:

- `SmartDashboard.tsx`: main operator console, pads, group strips, stage plan, VJ deck, preflight.
- `TopBar.tsx`: global mode navigation, BPM, blackout, safety LEDs, settings, library, support.
- `PatchPanel.tsx`: fixture patch and plan.
- `MacroTimeline.tsx` / `app/timeline`: timeline and automation workflow.
- `VisualizerView.tsx` and `components/three/*`: 3D visualization and safety simulation.
- `components/ui/SettingsModal.tsx`: settings, DMX outputs, MIDI, LLM providers, safety, license.
- `components/ui/DmxSetupWizard.tsx`: Art-Net / USB setup helper.

### Zustand Store

The root store is `apps/web/src/store/useStore.ts`. It composes slices:

- `uiSlice.ts`: app mode, view state, top-level UI flags, laser/pyro armed state.
- `smartModeSlice.ts`: Smart pads, widgets, DMX outputs, network state, blackout, master dimmer, fixtures.
- `showPlayerSlice.ts`: playlist, group levels, mutes, colors, master audio volume.
- `timelineSlice.ts`: clips, markers, automation tracks, timeline viewport.
- `projectSlice.ts`: project save/export state.
- `midiSlice.ts`: MIDI mapping and learn mode.
- `reactFlowSlice.ts`: patch/canvas nodes and edges.
- `toastSlice.ts`: notifications.

Persisted keys are declared in `partialize` inside `useStore.ts`. When adding persisted state:

1. Add it to the correct slice interface.
2. Add initial state and setter.
3. Add it to `partialize` if it must survive reloads.
4. Add a migration/default in `onRehydrateStorage` if older projects may miss it.
5. Add it to project export/import migration when it is project-level state.

### Type Contracts

The canonical DMX-facing contracts live in:

```text
apps/web/src/types/dmx.ts
```

It exports `DmxChannel`, `FixtureMode`, `FixtureProfile`, `PatchedFixture`, `MediaClip`, `TimelineProject`, `DmxOutputsConfig`, and `NetworkState`.

`types/show.ts` re-exports `types/dmx.ts` for backward compatibility.

## Backend Architecture

The backend is an Express app with Socket.IO, started from `apps/server/index.ts`.

Main service modules:

- `database.ts`: SQLite persistence and settings.
- `dmxRouter.ts`: unified output dispatcher for QLC+ OSC, QLC+ WebSocket, Art-Net, USB DMX.
- `usbDmx.ts`: native serial/FTDI USB DMX service.
- `pythonDmx.ts`: Python bridge process for Windows DMX output.
- `artnet.ts`: Art-Net output.
- `qlc.ts`, `qlcWsService.ts`, `qlcEngine.ts`: QLC+ integrations.
- `safetyGate.ts`: deterministic safety validation.
- `showActions.ts`: validates and executes structured show actions.
- `projectPackage.ts`: `.glowproject` package export/import.
- `fixtureProfileParser.ts`: QLC+ profile import.
- `ocr.ts`, `fixture-ai.ts`: fixture scan and LLM enhancement.
- `network.ts`: adapter discovery, Art-Net node scan, USB diagnosis.
- `syncClock.ts`: external BPM/sync source state.
- `resolume.ts`: Resolume OSC integration.
- `mediaGenerator.ts`: AI media provider proxy.
- `anomalyDetector.ts`: support diagnostics.
- `license.ts`: local license handling.
- `supportLog.ts`: support log capture.

## Real-Time DMX Flow

### Client Loop

`apps/web/src/lib/dmxEngine.ts` owns the browser-side DMX loop.

- Runs at `FPS = 44`.
- Stores universe/channel frames in memory.
- Emits only changed or forced channels.
- Sends `dmx_update` through Socket.IO.
- Supports priority locks so manual/timeline/background sources do not stomp each other.
- Delegates smooth fades to `DmxFader.ts`.
- Delegates movement patterns to `EffectEngine.ts`.
- Uses `setOutputGate()` as a client-side guard when all outputs are disabled.

Do not replace this loop with direct per-control socket spamming. Controls should write into `dmxEngine`, or into a backend action that routes through `dmxRouter`.

### Server Dispatch

The server receives `dmx_update`, routes it through `dmxRouter.setChannel()`, then broadcasts `dmx_sync` to connected clients. `dmxRouter.ts` clamps values and dispatches only to enabled outputs: `qlcOsc`, `qlcWs`, `artNet`, `usbDmx`. The Python DMX bridge is treated as part of the physical USB-DMX gate.

## Safety Gate

`apps/server/services/safetyGate.ts` is the source of truth.

Current hazards:

- `laser`
- `pyro`
- `drone`
- `external_api`

Operator roles:

- `beginner`
- `expert`
- `admin`

Rules enforced today:

- AI and external APIs cannot arm dangerous functions.
- Physical dangerous outputs are blocked in the MVP.
- Beginner role blocks sensitive functions.
- Laser power is hard-limited before physical output.
- Drone simulated trajectories are geofenced.

The frontend may display `laserArmed` and `pyroArmed`, but it does not grant authority. Server validation remains mandatory for show actions.

## Project Packages

`.glowproject` export/import is implemented in `apps/server/services/projectPackage.ts`.

Package contents:

- `manifest.json`
- `project.json`
- `database/snapshot.json`
- `database/project.db`
- `assets/manifest.json`

Imports use the controlled JSON snapshot path, not blind SQLite replacement. Keep that rule: project packages are user data and must be validated before merging into the live database.

## Adding A Feature

Recommended sequence:

1. Read the nearby code first.
2. Add or update TypeScript contracts.
3. Add Zustand slice state if the UI needs persistent or shared state.
4. Add backend route/service logic if data crosses process boundaries.
5. Keep safety decisions in server code.
6. Update API tests if the feature adds a route or changes a contract.
7. Run verification commands.
8. Update docs if the behavior is user-facing or integration-facing.

## Adding An API Route

Use this pattern in `apps/server/index.ts`:

```ts
app.post("/api/example", (req, res) => {
  try {
    res.json({ success: true });
  } catch (err: any) {
    addSupportLog("EXAMPLE", `Example failed: ${err.message}`, "warning");
    res.status(400).json({ error: "Example impossible", details: err.message });
  }
});
```

Guidelines:

- Keep route handlers thin.
- Move business logic into `services/*`.
- Validate required fields.
- Return JSON objects consistently.
- Log operational failures through `supportLog.ts` when useful.
- Add coverage in `apps/server/tests/api-smoke.ts` for critical routes.

## Adding Store State

Use slices, not ad hoc module globals.

```ts
export interface ExampleSlice {
  exampleValue: number;
  setExampleValue: (value: number) => void;
}

export const createExampleSlice: StateCreator<ExampleSlice, [], [], ExampleSlice> = (set) => ({
  exampleValue: 0,
  setExampleValue: (value) => set({ exampleValue: Math.max(0, value) }),
});
```

Then compose it in `useStore.ts` and add persisted keys only when needed.

## Testing

Primary commands:

```bash
npm run typecheck --workspaces
npm run test:api
npm run test:field
npm run build
```

Full package check:

```bash
npm run package:check
```

Release candidate gate without browser workers:

```bash
npm run release:check
```

This runs TypeScript, ESLint, web unit tests, API smoke, field smoke, and `git diff --check`, then writes a Markdown report under `reports/field/`. Add optional checks with PowerShell flags when the local machine allows them:

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/Run-ReleaseCandidateChecks.ps1 -IncludeBuild -IncludeUi -IncludeTtfl
```

Field smoke without Playwright:

```bash
npm run test:field
```

This starts a managed API server unless `GLOW_API_BASE` is set. It checks API auth, license/offline readiness, safety state, sync status, DMX output status, library + venue CRUD, and `.glowproject` export/import. Set `GLOW_WEB_BASE=http://localhost:3000` to add a lightweight frontend HTTP check without launching a browser worker.

Time-To-First-Light helper:

```bash
npm run field:ttfl
```

This checks the local API and web endpoints and writes a Markdown report under `reports/field/`. Use `powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/Measure-TTFL.ps1 -StartServices -RunFieldSmoke` when you want the script to start both dev servers and include the field smoke in the same report.

Manual field report:

```bash
npm run field:report
```

This creates a timestamped Markdown report under `reports/field/` from the checklist in `docs/FIELD_VALIDATION.md`. Fill it during the 15 minute "show from scratch" ritual after each merged chantier.

Release handoff:

- `docs/RELEASE_CANDIDATE_HANDOFF.md` is the concise checklist for the next owner.
- Generated reports in `reports/field/` are local evidence and are ignored by git.

Known Windows/Codex sandbox note:

- `next build` may compile successfully and then fail with `spawn EPERM` when the sandbox blocks a Next/Turbopack child process.
- When that happens, validate locally in an authorized Windows shell with `npm run build`.
- Run `npm run doctor:eperm` for a non-destructive Windows/Node diagnostic report. See `docs/WINDOWS_EPERM_DIAGNOSTIC.md`.

## Local Development

Run both workspaces:

```bash
npm run dev
```

Run separately:

```bash
npm run dev --workspace web
npm run dev --workspace server
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3005`
- Socket.IO: `ws://localhost:3005`

Useful health checks:

```bash
curl http://localhost:3005/api/license
curl http://localhost:3005/api/safety/status
curl http://localhost:3005/api/dmx/router
```

## Environment And Settings

Local settings are split between:

- `.env.local` for private local values.
- SQLite settings table through `/api/settings`.
- Browser localStorage through Zustand persistence.

Do not commit secrets. API keys entered through SettingsModal are local configuration and should not appear in docs, tests, or memory files.

## Common Pitfalls

- Do not send physical laser/pyro/drone commands directly from UI controls.
- Do not bypass `showActions.ts` for AI-generated show operations.
- Do not mutate persisted Zustand structures without migration/default handling.
- Do not write direct DMX loops in React components.
- Do not enable USB and Python bridge independently without checking port ownership.
- Do not rely on QLC+ being present in tests.
- Do not make docs claim `npm run build` is clean if it hit `spawn EPERM`.
