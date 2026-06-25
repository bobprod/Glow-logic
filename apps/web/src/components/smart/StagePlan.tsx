"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Eye, EyeOff, MapPinned, MousePointer2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import useStore, { type DmxGroup, type PatchedFixture } from "../../store/useStore";
import { normalizeStageGridPosition, type StageGridPosition } from "../../lib/stagePlanMapping";
import FixtureQuickStrip from "./FixtureQuickStrip";

const SNAP_PERCENT = 2;

function fixtureKey(fixture: PatchedFixture) {
  return String(fixture.nodeId || fixture.id);
}

function isMovingFixture(fixture: PatchedFixture) {
  return fixture.channels.some((channel) => channel.type === "pan" || channel.type === "tilt");
}

function snap(value: number) {
  return Math.round(value / SNAP_PERCENT) * SNAP_PERCENT;
}

function defaultPositionForFixture(fixture: PatchedFixture, index: number, total: number): StageGridPosition {
  const moving = isMovingFixture(fixture);
  const row = moving ? 16 : 82 - ((index % 3) * 16);
  const spread = Math.max(1, total - 1);
  return normalizeStageGridPosition({
    x: total === 1 ? 50 : 12 + ((index % total) / spread) * 76,
    y: row,
    z: moving ? 4.8 : 2.8,
  });
}

function positionFromPointer(event: React.PointerEvent<HTMLElement>, element: HTMLElement): StageGridPosition {
  const rect = element.getBoundingClientRect();
  return normalizeStageGridPosition({
    x: snap(((event.clientX - rect.left) / rect.width) * 100),
    y: snap(((event.clientY - rect.top) / rect.height) * 100),
    z: 0,
  });
}

function resolveGroupForFixture(fixture: PatchedFixture, groups: DmxGroup[]) {
  const ids = new Set([String(fixture.id), String(fixture.nodeId)]);
  return groups.find((group) => group.fixtureIds.some((id) => ids.has(String(id))));
}

export interface StagePlanProps {
  capabilities?: "perform" | "build";
}

export default function StagePlan({ capabilities = "perform" }: StagePlanProps) {
  const {
    setSmartSidebarPanel,
    fixtures,
    fetchFixtures,
    dmxGroups,
    fetchDmxGroups,
    groupLevels,
    groupMutes,
    groupColors,
    selectedFixtureId,
    selectedFixtureIds,
    selectedStageGroup,
    selectFixture: selectFixtureInStore,
    toggleFixtureSelection,
    setSelectedStageGroup,
    stagePlanHidden,
    stagePlanEditMode,
    setStagePlanEditMode,
    previewMode,
    setPreviewMode,
    setFixtureGridPosition,
    addFixtureToPlan,
    removeFixtureFromPlan,
  } = useStore();
  const buildMode = capabilities === "build";

  const planRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, StageGridPosition>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void fetchFixtures();
    void fetchDmxGroups();
  }, [fetchDmxGroups, fetchFixtures]);

  useEffect(() => {
    fixtures.forEach((fixture, index) => {
      const position = fixture.gridPosition;
      const unset = !position || (position.x === 0 && position.y === 0 && position.z === 0);
      if (unset) {
        setFixtureGridPosition(fixtureKey(fixture), defaultPositionForFixture(fixture, index, fixtures.length));
      }
    });
  }, [fixtures, setFixtureGridPosition]);

  const hiddenFixtureIds = useMemo(() => new Set(stagePlanHidden.map(String)), [stagePlanHidden]);
  const visibleFixtures = useMemo(
    () => fixtures.filter((fixture) => !hiddenFixtureIds.has(fixtureKey(fixture)) && !hiddenFixtureIds.has(String(fixture.id))),
    [fixtures, hiddenFixtureIds],
  );
  const hiddenFixtures = useMemo(
    () => fixtures.filter((fixture) => hiddenFixtureIds.has(fixtureKey(fixture)) || hiddenFixtureIds.has(String(fixture.id))),
    [fixtures, hiddenFixtureIds],
  );
  const sortedGroups = useMemo(() => [...dmxGroups].sort((a, b) => a.order - b.order), [dmxGroups]);

  const selectFixture = (fixture: PatchedFixture, event?: React.MouseEvent) => {
    const id = fixtureKey(fixture);
    // Shift/Ctrl/Cmd → ajoute/retire de la sélection partagée sans rouvrir l'inspecteur.
    if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      toggleFixtureSelection(id, true);
      return;
    }
    selectFixtureInStore(id, { openInspector: true });
  };

  const selectGroup = (group: DmxGroup) => {
    selectFixtureInStore(null);
    setSelectedStageGroup(group.id);
    setSmartSidebarPanel("inspector");
  };

  const commitDrag = (fixtureId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!planRef.current) return;
    const position = draftPositions[fixtureId] || positionFromPointer(event, planRef.current);
    setFixtureGridPosition(fixtureId, position);
    setDraftPositions((current) => {
      const next = { ...current };
      delete next[fixtureId];
      return next;
    });
  };

  const handlePlanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !stagePlanEditMode || !planRef.current) return;
    const position = positionFromPointer(event, planRef.current);
    setDraftPositions((current) => ({ ...current, [draggingId]: position }));
  };

  const hiddenCount = hiddenFixtures.length;

  return (
    <div className={buildMode ? "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-3 p-3" : "space-y-3"}>
      <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
            {buildMode ? "Plan de feu Build" : "Plan de scene"}
          </p>
          <p className="text-[11px] font-semibold text-slate-500">
            {visibleFixtures.length} fixtures visibles, {hiddenCount} hors plan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
              previewMode
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5"
            }`}
          >
            {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewMode ? "Preview" : "Live"}
          </button>
          <button
            type="button"
            onClick={() => setStagePlanEditMode(!stagePlanEditMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
              stagePlanEditMode
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5"
            }`}
          >
            {stagePlanEditMode ? <MousePointer2 className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            Edit
          </button>
          {stagePlanEditMode && (
            <div className="relative">
              <button
                type="button"
                disabled={hiddenFixtures.length === 0}
                onClick={() => setPickerOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Fixture
              </button>
              {pickerOpen && hiddenFixtures.length > 0 && (
                <div className="absolute right-0 top-10 z-40 max-h-64 w-64 overflow-y-auto rounded-xl border border-white/10 bg-[#12141A] p-1.5 shadow-2xl">
                  {hiddenFixtures.map((fixture) => (
                    <button
                      key={fixtureKey(fixture)}
                      type="button"
                      onClick={() => {
                        const id = fixtureKey(fixture);
                        addFixtureToPlan(id);
                        setFixtureGridPosition(id, { x: 50, y: 50, z: fixture.gridPosition?.z ?? 0 });
                        setPickerOpen(false);
                      }}
                      className="w-full rounded-lg px-2 py-2 text-left text-[11px] font-bold text-slate-300 hover:bg-white/5"
                    >
                      {fixture.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        ref={planRef}
        onPointerMove={handlePlanPointerMove}
        onPointerUp={(event) => {
          if (draggingId) commitDrag(draggingId, event);
          setDraggingId(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedStageGroup(null);
            selectFixtureInStore(null);
          }
        }}
        className="relative min-h-[420px] overflow-hidden rounded-xl border border-white/5 bg-[#050608] shadow-inner"
      >
        {previewMode && (
          <div className="absolute left-3 right-3 top-3 z-20 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-amber-200">
            Preview actif - sorties DMX coupees, visualisation locale uniquement
          </div>
        )}

        <div className="absolute inset-x-8 top-14 h-px bg-cyan-400/15" />
        <div className="absolute inset-x-8 bottom-12 h-px bg-white/10" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest text-slate-600">Public</div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-black uppercase tracking-widest text-slate-700">Stage left</div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[9px] font-black uppercase tracking-widest text-slate-700">Stage right</div>

        {visibleFixtures.map((fixture, index) => {
          const id = fixtureKey(fixture);
          const group = resolveGroupForFixture(fixture, sortedGroups);
          const position = draftPositions[id] || normalizeStageGridPosition(fixture.gridPosition || defaultPositionForFixture(fixture, index, visibleFixtures.length));
          const groupColor = group ? groupColors[group.id] || group.color : fixture.color || "#06b6d4";
          const level = group ? groupLevels[group.id] ?? 80 : 70;
          const muted = group ? groupMutes[group.id] === true : false;
          const selectedFixture = selectedFixtureIds.includes(id) || selectedFixtureId === id;
          const selectedGroup = Boolean(group && selectedStageGroup === group.id);
          const activeOpacity = muted ? 0.35 : Math.max(0.35, level / 100);
          const label = fixture.name.slice(0, 10);

          return (
            <div
              key={id}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <button
                type="button"
                onPointerDown={(event) => {
                  if (!stagePlanEditMode) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(id);
                  setDraftPositions((current) => ({ ...current, [id]: positionFromPointer(event, planRef.current || event.currentTarget) }));
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!stagePlanEditMode) selectFixture(fixture, event);
                }}
                onContextMenu={(event) => {
                  if (!stagePlanEditMode) return;
                  event.preventDefault();
                  removeFixtureFromPlan(id);
                }}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-black text-[9px] font-black transition-transform ${
                  stagePlanEditMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:scale-105"
                } ${selectedFixture || selectedGroup ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                style={{
                  borderColor: muted ? "#475569" : groupColor,
                  color: muted ? "#64748b" : groupColor,
                  boxShadow: muted ? "none" : `0 0 ${8 + level / 5}px ${groupColor}88`,
                  opacity: activeOpacity,
                }}
                title={stagePlanEditMode ? "Glisser pour deplacer, clic droit pour retirer du plan" : fixture.name}
              >
                {isMovingFixture(fixture) ? "LY" : "FX"}
                {!muted && level > 0 && (
                  <span
                    className="pointer-events-none absolute left-1/2 top-9 h-16 w-7 -translate-x-1/2 rounded-b-full blur-sm"
                    style={{
                      background: `linear-gradient(to bottom, ${groupColor}bb, transparent)`,
                      opacity: Math.min(0.5, level / 180),
                    }}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (group) selectGroup(group);
                  else selectFixture(fixture, event);
                }}
                className={`max-w-[86px] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${
                  selectedGroup ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-black/50 text-slate-300 hover:text-white"
                }`}
              >
                {group?.name || label}
              </button>
              {stagePlanEditMode && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFixtureFromPlan(id);
                  }}
                  className="rounded-md border border-red-400/20 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
                  title="Retirer du plan"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {visibleFixtures.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-xs font-semibold text-slate-500">
            Activez le mode Edit puis ajoutez des fixtures au plan.
          </div>
        )}
      </div>

      {/* Quick Strip — visible when a fixture is selected and sidebar inspector is not already open */}
      {selectedFixtureId && !selectedStageGroup && (
        <FixtureQuickStrip
          fixtureId={selectedFixtureId}
          onOpenInspector={() => {
            selectFixtureInStore(selectedFixtureId, { openInspector: true });
          }}
        />
      )}
      </div>
      {buildMode && (
        <BuildPlanPanel
          fixturesCount={fixtures.length}
          visibleCount={visibleFixtures.length}
          hiddenCount={hiddenCount}
          groupsCount={dmxGroups.length}
          editMode={stagePlanEditMode}
          onOpenLibrary={() => setSmartSidebarPanel("library")}
          onEnableEdit={() => setStagePlanEditMode(true)}
        />
      )}
    </div>
  );
}

function BuildPlanPanel({
  fixturesCount,
  visibleCount,
  hiddenCount,
  groupsCount,
  editMode,
  onOpenLibrary,
  onEnableEdit,
}: {
  fixturesCount: number;
  visibleCount: number;
  hiddenCount: number;
  groupsCount: number;
  editMode: boolean;
  onOpenLibrary: () => void;
  onEnableEdit: () => void;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-[#12141A] p-3 custom-scrollbar">
      <div className="mb-3 flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-cyan-300" />
        <p className="text-[10px] font-black uppercase tracking-widest text-white">Patch Build</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Fixtures" value={fixturesCount} />
        <Metric label="Visibles" value={visibleCount} />
        <Metric label="Hors plan" value={hiddenCount} />
        <Metric label="Groupes" value={groupsCount} />
      </div>

      <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-black/25 p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Workflow</p>
        <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
          Ajoutez les profils depuis la Bibliotheque, puis placez les projecteurs ici. La position sauvegardee est `gridPosition` et alimente aussi la previz 3D.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/20"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Bibliotheque
          </button>
          <button
            type="button"
            onClick={onEnableEdit}
            disabled={editMode}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 disabled:opacity-45"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {editMode ? "Edition active" : "Activer edition"}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Migration C8c</p>
        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
          L'ancien plan 2D de PatchPanel est remplace par ce composant commun. Les outils avances de patch resteront migrables en sous-composants `smart/patch/*`.
        </p>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/25 p-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-cyan-200">{value}</p>
    </div>
  );
}
