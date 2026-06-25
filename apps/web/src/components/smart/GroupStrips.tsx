"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GripVertical, Music2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import useStore, { type DmxGroup } from "../../store/useStore";
import { dmxEngine } from "../../lib/dmxEngine";
import { socket } from "../../lib/socket";

const LIVE_GROUP_ZONE_IDS: Record<string, number> = {
  Face: 1,
  Piste: 2,
  Bar: 3,
  Dancefloor: 4,
};

function dimmerValueForGroup(group: DmxGroup, fixtures: any[]) {
  if (group.fixtureIds.length === 0) return 0;
  const fixtureIdSet = new Set(group.fixtureIds.map(String));
  let maxValue = 0;

  fixtures.forEach((fixture) => {
    if (!fixtureIdSet.has(String(fixture.id)) && !fixtureIdSet.has(String(fixture.nodeId))) return;
    const dimmer = fixture.channels?.find((channel: any) => channel.type === "dimmer" || channel.type === "intensity");
    if (!dimmer) return;
    const universe = Number(fixture.universe || 1);
    const startAddress = Number(fixture.startAddress || fixture.start_address || 1);
    const channel = startAddress + Number(dimmer.channel || 1) - 1;
    maxValue = Math.max(maxValue, dmxEngine.getChannel(universe, channel));
  });

  return Math.round((maxValue / 255) * 100);
}

function emitGroupIntensity(group: DmxGroup, level: number, masterDimmer: number) {
  if (!group.backendZone) return;
  socket.emit("smart:zone_intensity", {
    zoneId: LIVE_GROUP_ZONE_IDS[group.backendZone],
    groupName: group.backendZone,
    value: Math.round(((level / 100) * 255) * (masterDimmer / 255)),
  });
}

type GroupStripsProps = {
  performanceMode?: boolean;
  readonly?: boolean;
};

export default function GroupStrips({ performanceMode = false, readonly = false }: GroupStripsProps) {
  const {
    dmxGroups,
    fetchDmxGroups,
    addDmxGroup,
    updateDmxGroup,
    deleteDmxGroup,
    reorderDmxGroups,
    groupPresets,
    saveGroupPreset,
    applyGroupPreset,
    deleteGroupPreset,
    groupLevels,
    groupMutes,
    midiLearnMode,
    midiLearnActiveControl,
    setMidiLearnActiveControl,
    midiMappings,
    setGroupLevel,
    setGroupMute,
    setGroupColor,
    masterDimmer,
    setMasterDimmer,
    smartEditMode,
    showLock,
    fixtures,
    fetchFixtures,
    selectedStageGroup,
    setSelectedStageGroup,
    setSelectedFixtureId,
    setSelectedFixtureIds,
    setSmartSidebarPanel,
  } = useStore();
  // Source de vérité unique : isLive (uiSlice). Les props performanceMode/readonly
  // restent en FALLBACK pour ne rien casser si le parent ne route pas encore.
  const isLive = useStore((s) => s.isLive);
  const live = isLive || performanceMode || readonly;
  const [presetOpen, setPresetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragOrder, setDragOrder] = useState<number | null>(null);
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({});
  const sortedGroups = useMemo(() => [...dmxGroups].sort((a, b) => a.order - b.order), [dmxGroups]);
  const masterPercent = Math.round((masterDimmer / 255) * 100);
  // Layout "performance" : compact + master masqué. Dérivé de live (source unique)
  // avec fallback sur la prop performanceMode d'origine.
  const isPerformanceLayout = live || performanceMode;
  const isReadOnly = live || readonly;
  const effectiveEditMode = !isReadOnly && !isPerformanceLayout && smartEditMode;

  useEffect(() => {
    void fetchFixtures();
    void fetchDmxGroups();
  }, [fetchDmxGroups, fetchFixtures]);

  useEffect(() => {
    const timer = setInterval(() => {
      setVuLevels(Object.fromEntries(sortedGroups.map((group) => [group.id, dimmerValueForGroup(group, fixtures)])));
    }, 100);
    return () => clearInterval(timer);
  }, [fixtures, sortedGroups]);

  const selectGroup = (group: DmxGroup) => {
    setSelectedStageGroup(group.id);
    setSelectedFixtureId(null);
    setSelectedFixtureIds([]);
    setSmartSidebarPanel("inspector");
  };

  const setLevel = (group: DmxGroup, level: number) => {
    setGroupLevel(group.id, level);
    emitGroupIntensity(group, level, masterDimmer);
  };

  const startRename = (group: DmxGroup) => {
    setEditingId(group.id);
    setDraftName(group.name);
  };

  const commitRename = (group: DmxGroup) => {
    const nextName = draftName.trim();
    if (nextName) updateDmxGroup(group.id, { name: nextName });
    setEditingId(null);
  };

  const savePreset = () => {
    const name = window.prompt("Nom du preset de groupes");
    if (name?.trim()) saveGroupPreset(name.trim());
    setPresetOpen(false);
  };

  return (
    <div className={isPerformanceLayout ? "h-full min-h-0 overflow-y-auto p-1 custom-scrollbar" : "space-y-4"}>
      {!isPerformanceLayout && <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/25 p-3.5 sm:flex-row sm:items-center">
        <div className="min-w-[130px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Master dimmer</p>
          <p className="text-[10px] text-slate-500">Scale global DMX</p>
        </div>
        <input
          type="range"
          min={0}
          max={255}
          value={masterDimmer}
          onChange={(event) => setMasterDimmer(Number(event.target.value))}
          className="min-w-[180px] flex-1 accent-cyan-400"
          aria-label="Master dimmer"
        />
        <span className="w-14 text-right font-mono text-xs font-black text-cyan-300">{masterPercent}%</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPresetOpen((open) => !open)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5"
          >
            Presets
          </button>
          {presetOpen && (
            <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border border-white/10 bg-[#12141A] p-1.5 shadow-2xl">
              <button onClick={savePreset} className="w-full rounded-lg px-2 py-2 text-left text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/10">
                Sauvegarder la config actuelle...
              </button>
              {groupPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (window.confirm(`Charger "${preset.name}" ?`)) applyGroupPreset(preset.id);
                      setPresetOpen(false);
                    }}
                    className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-[11px] font-bold text-slate-300 hover:bg-white/5"
                  >
                    {preset.name}
                  </button>
                  <button onClick={() => deleteGroupPreset(preset.id)} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10" title="Supprimer preset">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}

      <div className="dmx-groups-mixer grid grid-cols-2 items-end gap-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
        {sortedGroups.map((group) => {
          const level = groupLevels[group.id] ?? 80;
          const isMuted = groupMutes[group.id] === true;
          const hasLevelMapping = Boolean(midiMappings[`group_${group.id}_level`]);
          const hasMuteMapping = Boolean(midiMappings[`group_${group.id}_mute`]);
          const vu = isMuted ? 0 : vuLevels[group.id] ?? 0;
          const vuColor = vu > 90 ? "bg-red-400" : vu > 70 ? "bg-amber-400" : "bg-green-400";
          const isLearningLevel = midiLearnMode && midiLearnActiveControl === `group_${group.id}_level`;
          const isLearningMute = midiLearnMode && midiLearnActiveControl === `group_${group.id}_mute`;
          const isSelected = selectedStageGroup === group.id;

          return (
            <div
              key={group.id}
              draggable={effectiveEditMode}
              onDragStart={() => effectiveEditMode && setDragOrder(group.order)}
              onDragOver={(event) => effectiveEditMode && event.preventDefault()}
              onDrop={() => {
                if (effectiveEditMode && dragOrder !== null) reorderDmxGroups(dragOrder, group.order);
                setDragOrder(null);
              }}
              className={`flex ${isPerformanceLayout ? "min-h-[230px]" : "min-h-[260px]"} flex-col items-center gap-3 rounded-xl border bg-black/25 p-3.5 shadow-inner ${
                isSelected
                  ? "border-cyan-300/60 bg-cyan-500/10"
                  : isLearningLevel || isLearningMute ? "border-blue-400 bg-blue-500/10" : "border-white/5"
              }`}
            >
              {effectiveEditMode && (
                <div className="flex w-full items-center justify-between gap-1">
                  <GripVertical className="h-4 w-4 cursor-grab text-slate-500" />
                  <button onClick={() => startRename(group)} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white" title="Renommer">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (showLock) return;
                      if (window.confirm(`Supprimer le groupe "${group.name}" ?`)) deleteDmxGroup(group.id);
                    }}
                    disabled={showLock}
                    className="rounded p-1 text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                    title={showLock ? "Show lock actif" : "Supprimer"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <label className="relative h-8 w-8 rounded-full border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]" style={{ backgroundColor: group.color }}>
                <input
                  type="color"
                  value={group.color}
                  disabled={isReadOnly || isPerformanceLayout}
                  onChange={(event) => {
                    updateDmxGroup(group.id, { color: event.target.value });
                    setGroupColor(group.id, event.target.value);
                  }}
                  className={`absolute inset-0 h-full w-full opacity-0 ${(isReadOnly || isPerformanceLayout) ? "cursor-default" : "cursor-pointer"}`}
                  title="Modifier la couleur du groupe"
                />
              </label>

              <div className="flex h-32 items-center justify-center gap-2 py-2">
                <div className="relative h-28 w-[3px] overflow-hidden rounded-full bg-slate-900">
                  <div className={`absolute bottom-0 left-0 right-0 ${vuColor}`} style={{ height: `${vu}%` }} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={level}
                  onMouseDown={() => midiLearnMode && setMidiLearnActiveControl(`group_${group.id}_level`)}
                  onChange={(event) => {
                    if (midiLearnMode) return;
                    setLevel(group, Number(event.target.value));
                  }}
                  className="h-28 w-5 cursor-pointer accent-cyan-400"
                  style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
                  aria-label={`Intensite ${group.name}`}
                />
              </div>

              <div className="flex w-full flex-col items-center gap-1.5">
                <button
                  onMouseDown={() => midiLearnMode && setMidiLearnActiveControl(`group_${group.id}_mute`)}
                  onClick={() => !midiLearnMode && setGroupMute(group.id, !isMuted)}
                  className={`w-full rounded-lg border py-1.5 text-[9px] font-bold transition-colors ${
                    isMuted
                      ? "border-red-500/30 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      : "border-green-500/20 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                  } ${isLearningMute ? "ring-1 ring-blue-400" : ""}`}
                >
                  {isMuted ? "MUTE ON" : "MUTE"}
                </button>
                {editingId === group.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(group);
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => commitRename(group)}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-center text-[10px] font-bold text-white"
                  />
                ) : (
                  <button onClick={() => !isReadOnly && !isPerformanceLayout && selectGroup(group)} className={`max-w-full truncate text-center text-[10px] font-bold text-slate-300 ${(isReadOnly || isPerformanceLayout) ? "cursor-default" : "hover:text-white"}`}>
                    {group.name}
                  </button>
                )}
                <span className="font-mono text-[10px] font-bold text-slate-300">{level}%</span>
                <span className="max-w-full truncate text-center text-[9px] font-bold text-cyan-400/80">
                  {group.backendZone || "local"} - {group.fixtureIds.length} fx
                </span>
                {(hasLevelMapping || hasMuteMapping) && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-blue-300">
                    <Music2 className="h-3 w-3" />
                    MIDI
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {effectiveEditMode && (
          <button
            type="button"
            disabled={dmxGroups.length >= 12}
            onClick={addDmxGroup}
            title={dmxGroups.length >= 12 ? "Maximum 12 groupes" : "Ajouter un groupe"}
            className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/[0.04] p-4 text-xs font-black text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40"
          >
            <Plus className="h-5 w-5" />
            Groupe
          </button>
        )}
      </div>

      {effectiveEditMode && (
        <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-[11px] font-semibold text-slate-500">
          <Save className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />
          Les groupes sont synchronises avec la base locale quand le backend est disponible.
        </div>
      )}
    </div>
  );
}
