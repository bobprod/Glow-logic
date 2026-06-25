"use client";

import React, { useEffect } from "react";
import { Lightbulb, Filter } from "lucide-react";
import useStore from "@/store/useStore";
import FixtureInspectorPanel from "./smart/FixtureInspectorPanel";

interface FixtureControllerProps {
  className?: string;
}

export default function FixtureController({ className = "" }: FixtureControllerProps) {
  const {
    fixtures,
    fetchFixtures,
    selectedFixtureId,
    selectFixture: selectFixtureInStore,
    selectedFixtureIds,
  } = useStore();

  // focusMode / setFocusMode are added by the state agent (uiSlice). Tolerant
  // access so this component compiles even if the store shape lags behind.
  const store = useStore() as unknown as {
    focusMode?: boolean;
    setFocusMode?: (v: boolean) => void;
  };
  const focusMode = store.focusMode ?? false;
  const setFocusMode = store.setFocusMode ?? (() => {});

  // Display-only filter: a fixture is "used" when it has at least one patched
  // channel. Does NOT mutate the store — filtering happens at render time only.
  const visibleFixtures = focusMode
    ? fixtures.filter((fixture) => (fixture.channels?.length ?? 0) > 0)
    : fixtures;

  useEffect(() => {
    void fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    if (!selectedFixtureId && fixtures[0]?.nodeId) {
      selectFixtureInStore(fixtures[0].nodeId);
    }
  }, [fixtures, selectedFixtureId, selectFixtureInStore]);

  const handleSelectFixture = (nodeId: string) => {
    selectFixtureInStore(nodeId);
  };

  return (
    <div className={`flex h-full w-full gap-4 overflow-hidden bg-[#090b0e] p-4 text-slate-300 ${className}`}>
      <aside className="w-[240px] shrink-0 rounded-xl border border-white/5 bg-[#12141A] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Projecteurs</h2>
          </div>
          <button
            type="button"
            onClick={() => setFocusMode(!focusMode)}
            aria-pressed={focusMode}
            title={focusMode ? "Afficher toutes les fixtures" : "Afficher uniquement les fixtures utilisees"}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
              focusMode
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5"
            }`}
          >
            <Filter className="h-3 w-3" />
            Focus
          </button>
        </div>
        <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar">
          {visibleFixtures.length === 0 && focusMode && (
            <div className="rounded-lg border border-white/5 bg-black/25 px-3 py-4 text-center text-[11px] font-semibold text-slate-500">
              Aucune fixture utilisee. Patche des canaux ou desactive le mode Focus.
            </div>
          )}
          {visibleFixtures.map((fixture) => {
            const nodeId = fixture.nodeId || `fixture-${fixture.id}`;
            const selected = selectedFixtureIds.includes(nodeId) || selectedFixtureId === nodeId;
            return (
              <button
                key={nodeId}
                onClick={() => handleSelectFixture(nodeId)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                    : "border-white/5 bg-black/25 text-slate-400 hover:text-white"
                }`}
              >
                <span className="block truncate text-xs font-bold">{fixture.name}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  U{fixture.universe} Ch {fixture.startAddress || fixture.start_address}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        {selectedFixtureId ? (
          <FixtureInspectorPanel fixtureId={selectedFixtureId} layout="page" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/5 bg-black/25 text-sm font-semibold text-slate-500">
            Selectionne un projecteur pour ouvrir ses controles.
          </div>
        )}
      </main>
    </div>
  );
}
