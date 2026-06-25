"use client";

import React, { useEffect, useMemo } from "react";
import { Lightbulb, VolumeX } from "lucide-react";
import useStore, { type DmxGroup } from "../../store/useStore";
import { socket } from "../../lib/socket";

const COLOR_PRESETS = [
  { label: "Cyan", hex: "#22d3ee" },
  { label: "Rouge", hex: "#ef4444" },
  { label: "Violet", hex: "#a855f7" },
  { label: "Vert", hex: "#22c55e" },
  { label: "Orange", hex: "#f97316" },
  { label: "Rose", hex: "#ec4899" },
  { label: "Blanc", hex: "#ffffff" },
  { label: "Bleu", hex: "#3b82f6" },
];

const LIVE_GROUP_ZONE_IDS: Record<string, number> = {
  Face: 1,
  Piste: 2,
  Bar: 3,
  Dancefloor: 4,
};

function fixtureKey(fixture: any) {
  return String(fixture.id ?? fixture.fixtureId ?? fixture.nodeId);
}

export default function GroupInspectorPanel({ groupName }: { groupName: string }) {
  const {
    fixtures,
    fetchFixtures,
    dmxGroups,
    fetchDmxGroups,
    updateDmxGroup,
    groupLevels,
    groupMutes,
    setGroupLevel,
    setGroupMute,
    setGroupColor,
    selectFixture,
  } = useStore();

  useEffect(() => {
    void fetchFixtures();
    void fetchDmxGroups();
  }, [fetchDmxGroups, fetchFixtures]);

  const group = useMemo<DmxGroup | null>(
    () => dmxGroups.find((candidate) => candidate.id === groupName || candidate.name.toLowerCase() === groupName.toLowerCase()) ?? null,
    [dmxGroups, groupName],
  );

  const assignedFixtureIds = useMemo(() => new Set((group?.fixtureIds || []).map(String)), [group?.fixtureIds]);
  const assignedFixtures = useMemo(() => fixtures.filter((fixture) => assignedFixtureIds.has(fixtureKey(fixture))), [assignedFixtureIds, fixtures]);

  if (!group) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold text-slate-500">
        Groupe introuvable.
      </div>
    );
  }

  const level = groupLevels[group.id] ?? 80;
  const muted = groupMutes[group.id] === true;
  const color = group.color || "#ffffff";

  const changeLevel = (value: number) => {
    setGroupLevel(group.id, value);
    if (group.backendZone) {
      socket.emit("smart:zone_intensity", {
        zoneId: LIVE_GROUP_ZONE_IDS[group.backendZone],
        groupName: group.backendZone,
        value: Math.round((value / 100) * 255),
      });
    }
  };

  const changeColor = (hex: string) => {
    setGroupColor(group.id, hex);
    updateDmxGroup(group.id, { color: hex });
  };

  const toggleFixture = (fixtureId: string) => {
    const next = assignedFixtureIds.has(fixtureId)
      ? group.fixtureIds.filter((id) => String(id) !== fixtureId)
      : [...group.fixtureIds, fixtureId];
    updateDmxGroup(group.id, { fixtureIds: next });
  };

  const openFixture = (nodeId: string) => {
    selectFixture(nodeId, { openInspector: true });
  };

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-white/5 bg-black/25 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white">{group.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Controle rapide du groupe</p>
          </div>
          <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-[10px] text-cyan-300">{level}%</span>
        </div>

        <label className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
          Intensite
          <span className="text-cyan-300">{level}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={level}
          onChange={(event) => changeLevel(Number(event.target.value))}
          className="w-full accent-cyan-400"
          aria-label="Intensite du groupe"
        />

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Couleur</span>
            <label className="relative h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: color }}>
              <input
                type="color"
                value={color}
                onChange={(event) => changeColor(event.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => changeColor(preset.hex)}
                title={preset.label}
                className={`h-7 rounded-lg border transition-all ${color === preset.hex ? "scale-105 border-white ring-1 ring-white/30" : "border-transparent opacity-80 hover:opacity-100"}`}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => setGroupMute(group.id, !muted)}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-black transition-colors ${
            muted
              ? "border-red-500/30 bg-red-500/20 text-red-300"
              : "border-green-500/20 bg-green-500/10 text-green-300 hover:bg-green-500/20"
          }`}
        >
          <VolumeX className="h-4 w-4" />
          {muted ? "Demuter" : "Muter"}
        </button>
      </section>

      <section className="rounded-xl border border-white/5 bg-black/25 p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Fixtures du groupe</p>
        <div className="space-y-1.5">
          {fixtures.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-[11px] font-semibold leading-relaxed text-slate-500">
              Aucun projecteur patche.
            </p>
          ) : fixtures.map((fixture) => {
            const id = fixtureKey(fixture);
            const nodeId = fixture.nodeId || `fixture-${id}`;
            const checked = assignedFixtureIds.has(id);
            return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-2 py-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFixture(id)}
                  className="accent-cyan-400"
                  aria-label={`Assigner ${fixture.name}`}
                />
                <button onClick={() => openFixture(nodeId)} className="min-w-0 flex flex-1 items-center gap-2 text-left hover:text-white">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span className="truncate">{fixture.name}</span>
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] font-semibold text-slate-500">{assignedFixtures.length} projecteur(s) assigne(s).</p>
      </section>
    </div>
  );
}
