/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { buildOfflineProjectBackup } = require("../src/lib/offlineProjectBackup");
const { normalizeProjectState } = require("../src/lib/projectMigration");

const backup = buildOfflineProjectBackup({
  currentProjectName: "Mariage Test",
  smartPads: [{ id: 1 }, { id: 2 }],
  clips: [{ id: "clip-1" }],
  fixtures: [{ id: 10 }, { id: 11 }, { id: 12 }],
  masterDimmer: 180,
  blackout: true,
  smartBlackout: true,
  dmxOutputs: { artNet: true },
  networkState: { adapters: [], activeAdapter: null, discoveredNodes: [] },
});

assert.equal(backup.version, 1);
assert.equal(backup.projectName, "Mariage Test");
assert.equal(backup.pads, 2);
assert.equal(backup.clips, 1);
assert.equal(backup.fixtures, 3);
assert.equal(backup.state.masterDimmer, 180);
assert.equal(backup.state.blackout, true);
assert.deepEqual(backup.state.dmxOutputs, { artNet: true });

const restored = normalizeProjectState(backup.state, {
  smartPads: [],
  clips: [],
  markers: [],
  playlist: [],
  dmxGroups: [],
  groupLevels: {},
  groupMutes: {},
  groupColors: {},
  groupPresets: [],
}, { projectName: backup.projectName });

assert.equal(restored.state.currentProjectName, "Mariage Test");
assert.equal(restored.state.smartPads.length, 2);
assert.equal(restored.state.clips.length, 1);
assert.equal(restored.state.masterDimmer, 180);
assert.equal(restored.state.blackout, true);
assert.equal(restored.state.smartBlackout, true);

console.log("offlineProjectBackup tests passed");
