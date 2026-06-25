# Glow Logic API Reference

Last updated: 2026-06-10

Base URL:

```text
http://localhost:3005
```

All examples use JSON unless the route says `multipart/form-data` or binary.

## Response Conventions

Successful responses return JSON objects or arrays. Most write endpoints return a domain object or:

```json
{ "success": true }
```

Errors usually return:

```json
{ "error": "Message court", "details": "Detail technique optionnel" }
```

## Settings

### GET `/api/settings`

Returns all flattened settings from the local database.

### POST `/api/settings`

Updates flattened settings.

```json
{
  "qlc_host": "127.0.0.1",
  "qlc_port": "9999",
  "osc_port": "7700",
  "artnet_universe": "1"
}
```

## Diagnostics And Support

- `GET /api/diagnose`: returns cached or fresh diagnostics.
- `GET /api/support/logs`: returns support logs. Optional query: `limit`.
- `POST /api/support/logs/clear`: clears support logs.
- `GET /api/support/report`: returns a support report JSON bundle.

## License

- `GET /api/license`: returns local license status.
- `POST /api/license/activate`: activates a license key.
- `POST /api/license/dev-key`: creates a development key outside production.

Activate body:

```json
{ "key": "LICENSE-KEY" }
```

## Safety

Safety routes expose state and validation. They do not weaken server-side rules.

### GET `/api/safety`

Returns full safety state:

```json
{
  "operatorRole": "beginner",
  "dangerousPhysicalOutputsEnabled": false,
  "armed": {
    "laser": false,
    "pyro": false,
    "drone": false,
    "external_api": false
  },
  "rules": []
}
```

### GET `/api/safety/status`

Compact status for UI LEDs.

```json
{
  "laserArmed": false,
  "pyroArmed": false,
  "operatorRole": "beginner",
  "dangerousPhysicalOutputsEnabled": false
}
```

### POST `/api/safety/role`

```json
{ "role": "expert" }
```

Allowed roles: `beginner`, `expert`, `admin`.

### POST `/api/safety/arm`

```json
{
  "hazard": "laser",
  "armed": true,
  "confirmation": "ARM LASER"
}
```

Compatibility aliases are also accepted:

```json
{
  "type": "laser",
  "state": false
}
```

Valid hazards: `laser`, `pyro`, `drone`, `external_api`.

Arming requires a non-beginner role and exact confirmation. Disarming does not require confirmation.

### POST `/api/safety/validate`

```json
{
  "source": "api",
  "hazard": "laser",
  "outputMode": "physical",
  "description": "Fire laser cue",
  "payload": { "power": 255 }
}
```

Returns an allow/block decision with the current safety state.

## Show Actions

### POST `/api/show-actions`

Executes one or more structured show actions after validation.

```json
{
  "actions": [
    {
      "type": "dmx.set",
      "source": "manual",
      "outputMode": "simulation",
      "payload": {
        "universe": 1,
        "channel": 1,
        "value": 128
      }
    }
  ]
}
```

### POST `/api/actions/execute`

Alias for `/api/show-actions`.

## Resolume / Video

- `GET /api/video/resolume`: returns Resolume OSC status and config.
- `POST /api/video/resolume/config`: saves Resolume config.
- `POST /api/video/resolume/osc`: sends a raw OSC message.
- `POST /api/video/resolume/action`: sends a high-level Resolume action.

Config body:

```json
{
  "enabled": true,
  "host": "127.0.0.1",
  "port": 7000
}
```

Action body:

```json
{
  "action": "clip.connect",
  "payload": { "layer": 1, "clip": 1 }
}
```

## Sync / BPM

- `GET /api/sync/status`: returns sync clock state.
- `POST /api/sync/config`: updates source and trust settings.
- `POST /api/sync/bpm`: ingests a BPM update.

Config body:

```json
{
  "enabled": true,
  "trustExternalBpm": true,
  "source": "virtualdj"
}
```

Common sources: `manual`, `midi_clock`, `ableton_link`, `os2l`, `virtualdj`, `rekordbox`, `serato`.

BPM body:

```json
{
  "bpm": 128,
  "source": "manual",
  "confidence": 1
}
```

## LLM And Media

- `POST /api/llm/chat`: runs a configured LLM chat request.
- `GET /api/llm/media-providers`: returns AI media provider readiness.
- `POST /api/llm/generate-media`: creates an AI media generation job.

Chat body:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Create a blue chorus look" }
  ]
}
```

Media body:

```json
{
  "provider": "replicate",
  "prompt": "abstract light tunnel synced to bass",
  "type": "video"
}
```

## Projects

- `GET /api/projects`: lists projects. Optional query: `limit`.
- `GET /api/projects/health`: returns project storage health.
- `POST /api/projects/health/ai`: runs AI-assisted project health analysis.
- `POST /api/projects/repair`: attempts project storage repair.
- `POST /api/projects/export`: exports a provided project payload as `.glowproject`.
- `GET /api/projects/:id/export`: exports a saved project as `.glowproject`.
- `POST /api/projects/import`: imports a `.glowproject` file.
- `GET /api/projects/:id`: returns one project.
- `POST /api/projects`: saves a project.
- `DELETE /api/projects/:id`: deletes a project.

Save body:

```json
{
  "name": "My Show",
  "data": { "version": 3 }
}
```

`POST /api/projects/import` uses `multipart/form-data`:

- `project`: `.glowproject` file.
- `name`: optional imported project name.
- `mergeDatabase`: optional boolean string.

Project package responses use:

```text
application/vnd.glowlogic.project+zip
```

## Fixtures

- `GET /api/fixtures`: lists fixtures.
- `GET /api/fixtures/:id`: returns one fixture.
- `POST /api/fixtures`: saves a fixture.
- `POST /api/fixtures/import-profile`: imports a QLC+ `.qxf` profile.
- `DELETE /api/fixtures/:id`: deletes a fixture.

Fixture body:

```json
{
  "name": "Beam 150W",
  "manufacturer": "Generic",
  "startAddress": 1,
  "universe": 1,
  "channels": [
    { "channel": 1, "name": "Dimmer", "type": "dimmer", "min": 0, "max": 255 }
  ],
  "modes": [
    { "name": "Basic", "channels": [] }
  ]
}
```

`POST /api/fixtures/import-profile` uses `multipart/form-data` field `profile`.

## Fixture Groups

- `GET /api/fixture-groups`
- `GET /api/fixture-groups/:id`
- `POST /api/fixture-groups`
- `DELETE /api/fixture-groups/:id`

Body:

```json
{
  "name": "Face",
  "role": "front",
  "color": "#ffffff",
  "fixtureIds": [1, 2, 3]
}
```

## Venue Profiles

- `GET /api/venue-profiles`
- `GET /api/venue-profiles/:id`
- `POST /api/venue-profiles`
- `DELETE /api/venue-profiles/:id`

Body:

```json
{
  "name": "Club Main Room",
  "data": {
    "width": 12,
    "depth": 8,
    "height": 4
  }
}
```

## Library

- `GET /api/library`: lists library items. Optional query params: `kind`, `scope`.
- `GET /api/library/export`: exports all library items as JSON.
- `GET /api/library/:id`: returns one library item.
- `POST /api/library`: saves a library item.
- `POST /api/library/import`: imports library items.
- `DELETE /api/library/:id`: deletes a library item.

Scopes: `system`, `user`, `community`.

Save body:

```json
{
  "kind": "look_preset",
  "scope": "user",
  "name": "Blue Chorus",
  "description": "Wide blue chorus look",
  "tags": ["blue", "chorus"],
  "data": { "levels": { "master": 128 } }
}
```

Import body:

```json
{
  "items": [
    {
      "kind": "look_preset",
      "scope": "user",
      "name": "Imported Look",
      "data": {}
    }
  ]
}
```

## Fixture Scanning

### POST `/api/fixtures/scan`

`multipart/form-data`

Fields:

- `images`: 1 to 8 image files, or
- `image`: single image compatibility field.
- optional LLM fields: `llmProvider`, `llmKey`, `llmModel`, `llmBaseURL`, `llmApiFormat`.

Returns OCR channels and optional AI-enhanced fixture profile.

### POST `/api/fixtures/scan-text`

```json
{
  "rawText": "DMX channel table...",
  "llmProvider": "openai",
  "llmKey": "optional-key",
  "llmModel": "optional-model"
}
```

## DMX Hardware

- `GET /api/dmx/ports`: lists serial ports.
- `GET /api/dmx/usb-status`: returns USB DMX connection state.
- `POST /api/dmx/usb-config`: updates USB DMX config.
- `GET /api/dmx/router`: returns output gates.
- `POST /api/dmx/router`: updates output gates.
- `POST /api/dmx/flush`: flushes DMX state.
- `GET /api/dmx/live`: returns live DMX state when available.

USB config body:

```json
{
  "enabled": true,
  "portPath": "COM5",
  "universe": 1
}
```

Router body:

```json
{
  "qlcOsc": true,
  "qlcWs": false,
  "artNet": true,
  "usbDmx": false
}
```

## Network Setup

- `GET /api/network/adapters`: lists network adapters for Art-Net setup.
- `POST /api/network/configure`: configures a static Art-Net IP.
- `GET /api/network/poll`: runs ArtPoll discovery.
- `GET /api/network/usb-diagnose`: diagnoses a COM port.

Configure body:

```json
{
  "name": "Ethernet",
  "ip": "2.0.0.1",
  "mask": "255.0.0.0"
}
```

USB diagnose example:

```text
/api/network/usb-diagnose?port=COM5
```

## QLC+

- `GET /api/qlc/engine-status`
- `POST /api/qlc/engine-restart`
- `GET /api/qlc/ws-status`
- `POST /api/qlc/ws-enable`
- `POST /api/qlc/ws-disable`
- `POST /api/qlc/launch`
- `POST /api/qlc/install`
- `GET /api/qlc/workspace`

These routes manage QLC+ integration and should degrade gracefully if QLC+ is not installed or running.

## Scenes

- `GET /api/scenes`
- `GET /api/scenes/:id`
- `POST /api/scenes`
- `DELETE /api/scenes/:id`

Body:

```json
{
  "name": "Blue Intro",
  "data": {
    "dmxValues": { "1": 128 }
  }
}
```

## Cues

- `GET /api/cues`
- `GET /api/cues/:id`
- `POST /api/cues`
- `PUT /api/cues/:id`
- `DELETE /api/cues/:id`

Body:

```json
{
  "name": "Main Cue List",
  "cues": []
}
```

## Socket.IO Events

Socket URL:

```text
ws://localhost:3005
```

### Client To Server: `dmx_update`

```json
{
  "universe": 1,
  "channel": 1,
  "value": 128
}
```

Routes a channel through `dmxRouter`.

### Client To Server: `acp_message`

Relays an agent/control protocol message to other connected clients.

```json
{
  "type": "status",
  "from": "web",
  "payload": {}
}
```

Additional live-control events are registered by `services/liveControl.ts`.

### Server To Client: `dmx_sync`

Broadcast after each accepted DMX update.

```json
{
  "universe": 1,
  "channel": 1,
  "value": 128
}
```

### Server To Client: `dmx_bridge_status`

Emitted by Python DMX bridge lifecycle.

```json
{ "ready": true }
```

or:

```json
{
  "ready": false,
  "error": "Bridge error message"
}
```

### Server To Client: `acp_message`

Relayed message with server metadata:

```json
{
  "type": "status",
  "from": "web",
  "relayId": "acp_...",
  "receivedAt": "2026-06-10T00:00:00.000Z",
  "payload": {}
}
```
