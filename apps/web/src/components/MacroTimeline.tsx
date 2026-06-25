"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Maximize2, Play, Pause, SkipBack, SkipForward, Trash2, X, ZoomIn, ZoomOut, Flag, Plus, SlidersHorizontal, GripHorizontal, Magnet, Music, Crosshair, ChevronDown, ChevronRight } from 'lucide-react';
import { socket } from '../lib/socket';
import { dmxEngine } from '../lib/dmxEngine';
import { showAudioEngine } from '../lib/ShowAudioEngine';
import { startCrossfade, isContinuousChannel, type CrossfadeTarget } from '../lib/crossfadeEngine';
import useStore from '../store/useStore';
import { AutomationChannelType, AutomationEasing, AutomationTrack, CueMarker, TimelineClip } from '../store/slices/timelineSlice';
import WaveformView from './timeline/WaveformView';
import SceneClipPanel from './timeline/SceneClipPanel';
import CueClipPanel from './timeline/CueClipPanel';
import ChaserTrackPanel from './timeline/ChaserTrackPanel';
import VisualizerView from './VisualizerView';
import type { AiInspectorLogType } from '../store/slices/uiSlice';

// ─── Types ────────────────────────────────────────────────────
export type TimelineInspectorLogEntry = { id: number; type: 'sys' | 'ai' | 'warn' | 'osc' | 'info'; text: string };

export const TIMELINE_INSPECTOR_INIT_LOGS: TimelineInspectorLogEntry[] = [];

export const TIMELINE_INSPECTOR_LOG_COLOR: Record<TimelineInspectorLogEntry['type'], string> = {
    sys: 'text-green-400', ai: 'text-cyan-400', warn: 'text-yellow-400',
    osc: 'text-slate-400', info: 'text-blue-400',
};

type TimelineTrackId = TimelineClip['track'];

const TRACKS: TimelineTrackId[] = ['lights', 'visuals', 'fx'];
const TRACK_LABELS: Record<TimelineTrackId, string> = { lights: 'LIGHTS', visuals: 'VISUALS', fx: 'FX (LASER)' };

const CLIP_COLORS = [
    { color: 'bg-cyan-500',   text: 'text-cyan-300' },
    { color: 'bg-pink-500',   text: 'text-pink-300' },
    { color: 'bg-purple-500', text: 'text-purple-300' },
    { color: 'bg-green-500',  text: 'text-green-300' },
    { color: 'bg-orange-500', text: 'text-orange-300' },
    { color: 'bg-yellow-500', text: 'text-yellow-300' },
    { color: 'bg-blue-500',   text: 'text-blue-300' },
];

const MARKER_COLORS = ['#22d3ee', '#f43f5e', '#a78bfa', '#4ade80', '#fb923c', '#facc15'];
const AUTOMATION_COLORS = ['#22d3ee', '#a78bfa', '#4ade80', '#f43f5e', '#fb923c', '#38bdf8'];
const AUTOMATION_TYPES: AutomationChannelType[] = ['dimmer', 'pan', 'tilt', 'red', 'green', 'blue', 'strobe', 'color', 'custom'];
const TRACK_LABEL_WIDTH_PX = 56;
const LANE_H = 36;

// ─── Helpers ─────────────────────────────────────────────────
function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    const msFmt = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${min}:${sec}.${msFmt}`;
}

function parseTimeInput(value: string): number | null {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    if (!normalized.includes(':')) {
        const seconds = Number(normalized);
        return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
    }
    const [minRaw, secRaw = '0'] = normalized.split(':');
    const minutes = Number(minRaw);
    const seconds = Number(secRaw);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.max(0, (minutes * 60 + seconds) * 1000);
}
function clampDmx(value: number) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function applyEasing(t: number, easing: AutomationEasing = 'linear') {
    if (easing === 'hold') return 0;
    if (easing === 'easeIn') return t * t;
    if (easing === 'easeOut') return 1 - (1 - t) * (1 - t);
    if (easing === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return t;
}

function getAutomationValueAtTime(track: AutomationTrack, timeMs: number): number | null {
    const keyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
    if (keyframes.length === 0) return null;
    if (timeMs <= keyframes[0].timeMs) return clampDmx(keyframes[0].value);
    const last = keyframes[keyframes.length - 1];
    if (timeMs >= last.timeMs) return clampDmx(last.value);

    for (let i = 0; i < keyframes.length - 1; i += 1) {
        const a = keyframes[i];
        const b = keyframes[i + 1];
        if (timeMs >= a.timeMs && timeMs <= b.timeMs) {
            const span = Math.max(1, b.timeMs - a.timeMs);
            const t = (timeMs - a.timeMs) / span;
            const eased = applyEasing(t, a.easing ?? 'linear');
            return clampDmx(a.value + (b.value - a.value) * eased);
        }
    }

    return clampDmx(last.value);
}

// ─── New Clip Modal ───────────────────────────────────────────
function NewClipModal({ track, startTime, onConfirm, onCancel }: {
    track: TimelineTrackId; startTime: number;
    onConfirm: (name: string, color: string, textColor: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [colorIdx, setColorIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const c = CLIP_COLORS[colorIdx];
        onConfirm(name.trim(), c.color, c.text);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="bg-[#12141A] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
                <h2 className="text-white font-black text-sm mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-cyan-400" /> Nouveau Clip — <span className="text-cyan-400">{TRACK_LABELS[track]}</span>
                </h2>
                <p className="text-slate-500 text-[10px] mb-4">Position : {formatTime(startTime)}</p>
                <input
                    ref={inputRef}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nom du clip..."
                    className="w-full bg-[#1a1c23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 outline-none focus:border-cyan-500/50"
                />
                <div className="flex gap-2 mb-4">
                    {CLIP_COLORS.map((c, i) => (
                        <button key={i} type="button" onClick={() => setColorIdx(i)}
                            className={`w-6 h-6 rounded-full ${c.color} transition-transform ${colorIdx === i ? 'scale-125 ring-2 ring-white/60' : 'opacity-60 hover:opacity-100'}`}
                        />
                    ))}
                </div>
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-cyan-500 text-black font-bold py-1.5 rounded-lg text-sm hover:bg-cyan-400 transition-colors">Créer</button>
                    <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 text-slate-300 font-bold py-1.5 rounded-lg text-sm hover:bg-slate-700 transition-colors">Annuler</button>
                </div>
            </form>
        </div>
    );
}

// ─── Marker Modal ─────────────────────────────────────────────
function NewMarkerModal({ time, onConfirm, onCancel }: {
    time: number;
    onConfirm: (name: string, color: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [colorIdx, setColorIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onConfirm(name.trim(), MARKER_COLORS[colorIdx]);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="bg-[#12141A] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl">
                <h2 className="text-white font-black text-sm mb-3 flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-yellow-400" /> Cue Marker — {formatTime(time)}
                </h2>
                <input
                    ref={inputRef}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nom du cue..."
                    className="w-full bg-[#1a1c23] border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-yellow-500/50"
                />
                <div className="flex gap-2 mb-3">
                    {MARKER_COLORS.map((c, i) => (
                        <button key={i} type="button" onClick={() => setColorIdx(i)}
                            className={`w-5 h-5 rounded-full transition-transform ${colorIdx === i ? 'scale-125 ring-2 ring-white/60' : 'opacity-60 hover:opacity-100'}`}
                            style={{ background: c }}
                        />
                    ))}
                </div>
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-yellow-500 text-black font-bold py-1.5 rounded-lg text-xs hover:bg-yellow-400 transition-colors">Ajouter</button>
                    <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 text-slate-300 font-bold py-1.5 rounded-lg text-xs hover:bg-slate-700 transition-colors">Annuler</button>
                </div>
            </form>
        </div>
    );
}

/**
 * Resolve the DMX channel *type* (dimmer, pan, gobo…) for an absolute
 * universe/channel pair from the patched fixtures. Used to decide if a
 * crossfade should interpolate (continuous) or snap (discrete).
 * Returns undefined when no fixture covers that channel (=> continuous by default).
 */
function resolveType(fixtures: any[] | undefined, universe: number, channel: number): string | undefined {
    if (!Array.isArray(fixtures)) return undefined;
    for (const fixture of fixtures) {
        const fxUniverse = Number(fixture?.universe ?? 1);
        if (fxUniverse !== universe) continue;
        const start = Number(fixture?.startAddress ?? fixture?.start_address ?? 1);
        const fixtureChannels = Array.isArray(fixture?.channels) ? fixture.channels : [];
        for (const ch of fixtureChannels) {
            const offset = Number(ch?.channel ?? 1);
            if (start + offset - 1 === channel) {
                return ch?.type != null ? String(ch.type) : undefined;
            }
        }
    }
    return undefined;
}

// ─── Main Component ───────────────────────────────────────────
export default function MacroTimeline() {
    const {
        isTimelineVisible,
        clips, duration, zoom,
        addClip, updateClip, deleteClip,
        markers, addMarker, updateMarker, deleteMarker,
        addMarkers, moveMarkers, deleteMarkers,
        markerClipboard, setMarkerClipboard,
        automationTracks,
        addAutomationTrack,
        updateAutomationTrack,
        deleteAutomationTrack,
        addAutomationKeyframe,
        updateAutomationKeyframe,
        deleteAutomationKeyframe,
        setDuration, setZoom,
        automationRecArmed,
        recTargetFixtureId,
        timelinePlaying,
        setTimelinePlaybackState,
        setProView,
        smartPads,
        addToast,
        addAiInspectorLog,
        timelineHeight,
        setTimelineHeight,
        snapEnabled,
        setSnapEnabled,
        bpmGridVisible,
        setBpmGridVisible,
        bpm,
        setBpm,
        fixtures,
    } = useStore();

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    // Master audio track (timeline audio clock) — ADDITIF. Pas de piste => horloge delta.
    const [audioTrackName, setAudioTrackName] = useState<string | null>(null);
    const audioObjectUrlRef = useRef<string | null>(null);

    // Loop region
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);
    const [isLoopEnabled, setIsLoopEnabled] = useState(false);

    // Multi-select
    const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
    const [clipboard, setClipboard] = useState<TimelineClip[]>([]);
    const [selectedAutomationTrackId, setSelectedAutomationTrackId] = useState<string | null>(null);
    const [selectedKeyframe, setSelectedKeyframe] = useState<{ trackId: string; keyframeId: string } | null>(null);
    const [draggingKeyframe, setDraggingKeyframe] = useState<{ trackId: string; keyframeId: string } | null>(null);
    const [keyframeMenu, setKeyframeMenu] = useState<{ trackId: string; keyframeId: string; x: number; y: number } | null>(null);
    const [markerEditor, setMarkerEditor] = useState<{ id: string; x: number; y: number } | null>(null);
    const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
    const [followPlayhead, setFollowPlayhead] = useState(true);

    // Drag / Resize
    const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
    const [dragOffsetMs, setDragOffsetMs] = useState(0);
    const [resizingClipId, setResizingClipId] = useState<string | null>(null);

    // Ruler interaction
    const [rulerDragMode, setRulerDragMode] = useState<'playhead' | 'loop' | 'box' | null>(null);
    const [loopAnchorMs, setLoopAnchorMs] = useState(0);
    const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

    // ── Group marker editing (A4 — additif) ──
    // selectedMarkerIds : sélection de groupe locale. Vide => comportement single inchangé.
    const [selectedMarkerIds, setSelectedMarkerIds] = useState<Set<string>>(new Set());
    // markerClipboard + setMarkerClipboard viennent DU STORE (timelineSlice, B5) afin de
    // SURVIVRE au changement de morceau (loadActiveTimeline ne touche pas markerClipboard).
    // L'ancien state local A4 est remplacé : la copie/colle reste identique, mais le presse-papier
    // persiste désormais après un switch de song.
    // Box-select (Ctrl/Cmd+drag sur règle, zone vide) : intervalle de temps en ms.
    const [markerBox, setMarkerBox] = useState<{ startMs: number; currentMs: number } | null>(null);
    // Drag de groupe : ancre = id tiré + temps initial, et flag duplication.
    const groupDragRef = useRef<{ anchorId: string; anchorStartMs: number; ids: string[]; duplicate: boolean; dupIds: string[] | null; lastDelta: number } | null>(null);
    const [markerGroupDragActive, setMarkerGroupDragActive] = useState(false);


    // Resize handle
    const [isResizingPanel, setIsResizingPanel] = useState(false);
    const [tracksBodyWidth, setTracksBodyWidth] = useState(800);
    const resizeStartY = useRef(0);
    const resizeStartH = useRef(288);

    // Modals
    const [newClipPending, setNewClipPending] = useState<{ track: TimelineTrackId; startTime: number } | null>(null);
    const [newMarkerPending, setNewMarkerPending] = useState<number | null>(null);
    const [arrangementTab, setArrangementTab] = useState<'scenes' | 'cues' | 'chasers' | 'automations' | 'visualizer'>('scenes');

    // Refs
    const tracksBodyRef = useRef<HTMLDivElement>(null); // zone tracks (sans labels)
    const rulerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const lastTickRef = useRef<number>(0);
    const keyframeLaneTopRef = useRef(0);
    const tapTimesRef = useRef<number[]>([]);

    // Zoom window: viewDuration = how many ms are visible
    const viewDuration = duration / zoom;
    const [viewStart, setViewStart] = useState(0);
    const viewEnd = Math.min(viewStart + viewDuration, duration);

    // Convert ms ↔ % within visible window
    const msToPct = (ms: number) => ((ms - viewStart) / viewDuration) * 100;
    const pxToMs = useCallback((px: number, containerWidth: number) =>
        viewStart + (px / containerWidth) * viewDuration,
        [viewStart, viewDuration]);
    // Snap helper
    const snapMs = useCallback((ms: number) => {
        if (!snapEnabled) return ms;
        const beatMs = bpm > 0 && bpmGridVisible ? 60000 / bpm : 0;
        const gridRes = viewDuration <= 30000 ? 100 : viewDuration <= 120000 ? 500 : 1000;
        const snapRes = beatMs > 0 ? beatMs : gridRes;
        return Math.round(ms / snapRes) * snapRes;
    }, [snapEnabled, bpm, bpmGridVisible, viewDuration]);

    // Panel resize handlers
    const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingPanel(true);
        resizeStartY.current = e.clientY;
        resizeStartH.current = timelineHeight;
    }, [timelineHeight]);

    useEffect(() => {
        if (!isResizingPanel) return;
        const onMove = (e: MouseEvent) => {
            const delta = resizeStartY.current - e.clientY;
            setTimelineHeight(resizeStartH.current + delta);
        };
        const onUp = () => setIsResizingPanel(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [isResizingPanel, setTimelineHeight]);
    useEffect(() => {
        const element = tracksBodyRef.current;
        if (!element) return;
        const updateWidth = () => setTracksBodyWidth(element.clientWidth || 800);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, [timelineHeight]);

    const selectedAutomationTrack = automationTracks.find(track => track.id === selectedAutomationTrackId)
        ?? (selectedKeyframe ? automationTracks.find(track => track.id === selectedKeyframe.trackId) : null)
        ?? automationTracks[0]
        ?? null;
    const selectedAutomationKeyframe = selectedKeyframe
        ? automationTracks.find(track => track.id === selectedKeyframe.trackId)?.keyframes.find(keyframe => keyframe.id === selectedKeyframe.keyframeId) ?? null
        : null;

    useEffect(() => {
        if (timelinePlaying !== isPlaying) {
            setIsPlaying(timelinePlaying);
        }
    }, [isPlaying, timelinePlaying]);

    useEffect(() => {
        setTimelinePlaybackState(useStore.getState().timelinePlaying, elapsed);
    }, [elapsed, setTimelinePlaybackState]);

    // -- Timer (requestAnimationFrame, drift-free) ----------------
    useEffect(() => {
        if (!isPlaying) {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }
        lastTickRef.current = performance.now();
        const loop = (now: number) => {
            const delta = now - lastTickRef.current;
            lastTickRef.current = now;
            // Horloge maitre = position audio quand une piste joue ; sinon delta RAF.
            if (showAudioEngine.hasTrack() && showAudioEngine.isTrackPlaying()) {
                const audioMs = showAudioEngine.getAudioPositionMs();
                setElapsed(() => {
                    if (isLoopEnabled && loopStart !== null && loopEnd !== null && audioMs >= loopEnd) {
                        // Boucle : on reseek l'audio (qui pilote l'horloge) au point de depart.
                        showAudioEngine.seekTrack(loopStart);
                        return loopStart;
                    }
                    return audioMs > duration ? duration : audioMs;
                });
            } else {
                setElapsed(prev => {
                    const next = prev + delta;
                    if (isLoopEnabled && loopStart !== null && loopEnd !== null && next >= loopEnd) return loopStart;
                    return next > duration ? duration : next;
                });
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [isPlaying, duration, isLoopEnabled, loopStart, loopEnd]);

    // Auto-scroll playhead into view (only when follow is on)
    useEffect(() => {
        if (!followPlayhead) return;
        if (elapsed < viewStart || elapsed > viewEnd) {
            setViewStart(Math.max(0, Math.min(elapsed, duration - viewDuration)));
        }
    }, [followPlayhead, duration, elapsed, viewDuration, viewEnd, viewStart]);

    // ── AI Inspector ───────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const addLog = (type: AiInspectorLogType, text: string) => addAiInspectorLog(type, text);
        socket.on('connect', () => addLog('sys', '[SYS] Socket.IO connecté.'));
        socket.on('disconnect', () => addLog('warn', '[WARN] Déconnecté du backend.'));
        socket.on('timeline_log', (data: { type: AiInspectorLogType; text: string }) => {
            addLog(data.type || 'info', data.text);
        });
        return () => {
            socket?.off('connect');
            socket?.off('disconnect');
            socket?.off('timeline_log');
        };
    }, [addAiInspectorLog]);

    // Sync playback playhead with DMX scenes
    const activeWidgetsRef = useRef<Set<string>>(new Set());
    const activeDmxClipsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        automationTracks.forEach((track) => {
            if (!track.enabled) return;
            const value = getAutomationValueAtTime(track, elapsed);
            if (value === null) return;
            dmxEngine.setChannel(track.universe, track.channel, value, { source: 'timeline' });
        });

        if (!isPlaying && elapsed === 0) {
            // Deactivate all previously active widgets on stop
            activeWidgetsRef.current.forEach((key) => {
                const [pageIdStr, widgetIdStr] = key.split('-');
                socket.emit('smart:trigger_scene', {
                    pageId: parseInt(pageIdStr, 10),
                    widgetId: parseInt(widgetIdStr, 10),
                    active: false,
                });
            });
            activeWidgetsRef.current.clear();
            activeDmxClipsRef.current.clear();
            return;
        }

        // Find currently active clips at playhead position
        const activeClips = clips.filter(
            (clip) => clip.startTime <= elapsed && elapsed <= clip.startTime + clip.duration
        );

        const newActiveKeys = new Set<string>();
        const newActiveDmxClipIds = new Set<string>();
        activeClips.forEach((clip) => {
            if (clip.qlcPage !== undefined && clip.qlcWidget !== undefined) {
                newActiveKeys.add(`${clip.qlcPage}-${clip.qlcWidget}`);
            }
            if (clip.dmxCommands && clip.dmxCommands.length > 0) {
                newActiveDmxClipIds.add(clip.id);
            }
        });


        const sameSet = (a: Set<string>, b: Set<string>) =>
            a.size === b.size && [...a].every((item) => b.has(item));
        if (sameSet(newActiveKeys, activeWidgetsRef.current) &&
            sameSet(newActiveDmxClipIds, activeDmxClipsRef.current)) {
            return;
        }
        // Create a lookup map for clip names to make logging nice
        const clipNameMap: Record<string, string> = {};
        clips.forEach((c) => {
            if (c.qlcPage !== undefined && c.qlcWidget !== undefined) {
                clipNameMap[`${c.qlcPage}-${c.qlcWidget}`] = c.name;
            }
        });

        // 1. Deactivate widgets that are no longer active
        activeWidgetsRef.current.forEach((key) => {
            if (!newActiveKeys.has(key)) {
                const [pageIdStr, widgetIdStr] = key.split('-');
                socket.emit('smart:trigger_scene', {
                    pageId: parseInt(pageIdStr, 10),
                    widgetId: parseInt(widgetIdStr, 10),
                    active: false,
                });
                socket.emit('timeline_log', {
                    type: 'sys',
                    text: `[Timeline] Désactivation de la scène "${clipNameMap[key] || key}"`,
                });
            }
        });

        // 2. Activate new widgets
        newActiveKeys.forEach((key) => {
            if (!activeWidgetsRef.current.has(key)) {
                const [pageIdStr, widgetIdStr] = key.split('-');
                socket.emit('smart:trigger_scene', {
                    pageId: parseInt(pageIdStr, 10),
                    widgetId: parseInt(widgetIdStr, 10),
                    active: true,
                });
                socket.emit('timeline_log', {
                    type: 'sys',
                    text: `[Timeline] Déclenchement de la scène "${clipNameMap[key] || key}"`,
                });
            }
        });

        newActiveDmxClipIds.forEach((clipId) => {
            if (activeDmxClipsRef.current.has(clipId)) return;
            const clip = clips.find((candidate) => candidate.id === clipId);
            if (!clip?.dmxCommands?.length) return;
            // Masking A2: absent enabledChannels => all channels; [] => none.
            const mask = clip.enabledChannels;
            const commands = mask
                ? clip.dmxCommands.filter((command) => mask.includes(command.channel))
                : clip.dmxCommands;
            // Crossfade A3: build targets, continuity resolved from the patched fixtures.
            const targets: CrossfadeTarget[] = commands.map((command) => ({
                universe: command.universe,
                channel: command.channel,
                value: command.value,
                continuous: isContinuousChannel(resolveType(fixtures, command.universe, command.channel)),
            }));
            // fadeSeconds absent/0 => durationMs 0 => instant application (= current behaviour).
            startCrossfade(targets, (clip.fadeSeconds ?? 0) * 1000, { source: 'timeline' });
            socket.emit('timeline_log', {
                type: 'sys',
                text: `[Timeline] Clip DMX "${clip.name}" (${commands.length} canaux)`,
            });
        });

        activeWidgetsRef.current = newActiveKeys;
        activeDmxClipsRef.current = newActiveDmxClipIds;
    }, [elapsed, clips, isPlaying, automationTracks, fixtures]);

    // ── Group MARKER keyboard shortcuts (A4) — prioritaire si markers selectionnes ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            // Echap : deselection (toujours dispo des qu'il y a une selection).
            if (e.key === 'Escape' && selectedMarkerIds.size > 0) {
                setSelectedMarkerIds(new Set());
                return;
            }
            if (selectedMarkerIds.size === 0) return;
            const ids = Array.from(selectedMarkerIds);
            // Suppr / Backspace => deleteMarkers (1 undo).
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                deleteMarkers(ids);
                setSelectedMarkerIds(new Set());
                return;
            }
            // Ctrl/Cmd+C => copie des marqueurs selectionnes.
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                setMarkerClipboard(markers.filter((m) => selectedMarkerIds.has(m.id)));
                return;
            }
            // Ctrl/Cmd+V => colle au playhead (offsets relatifs au 1er), 1 undo via addMarkers.
            if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
                if (markerClipboard.length === 0) return;
                e.preventDefault();
                const minTime = Math.min(...markerClipboard.map((m) => m.time));
                const stamp = Date.now();
                const pasted = markerClipboard.map((m, i) => ({
                    ...m,
                    id: `mkr-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                    time: Math.max(0, Math.min(m.time - minTime + elapsed, duration)),
                }));
                addMarkers(pasted);
                setSelectedMarkerIds(new Set(pasted.map((m) => m.id)));
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedMarkerIds, markerClipboard, markers, deleteMarkers, addMarkers, elapsed, duration]);

    // ── Multi-select keyboard shortcuts ────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Si des marqueurs sont selectionnes, ils ont la priorite (handler dedie ci-dessus).
            if (selectedMarkerIds.size > 0) return;
            if (selectedClipIds.length === 0 && clipboard.length === 0) return;
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                selectedClipIds.forEach(id => deleteClip(id));
                setSelectedClipIds([]);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                setClipboard(clips.filter(c => selectedClipIds.includes(c.id)));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (clipboard.length === 0) return;
                const minStart = Math.min(...clipboard.map(c => c.startTime));
                const pasted: string[] = [];
                clipboard.forEach(clip => {
                    const newId = `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    addClip({ ...clip, id: newId, startTime: clip.startTime - minStart + elapsed + 2000 });
                    pasted.push(newId);
                });
                setSelectedClipIds(pasted);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedClipIds, clipboard, clips, deleteClip, addClip, elapsed, selectedMarkerIds]);

    // ── Playback helpers ───────────────────────────────────────
    const handlePlayPause = useCallback(() => {
        const next = !isPlaying;
        if (showAudioEngine.hasTrack()) {
            if (next) {
                // Cale l'audio sur le playhead courant avant de lancer.
                showAudioEngine.seekTrack(elapsed);
                showAudioEngine.playTrack();
            } else {
                showAudioEngine.pauseTrack();
            }
        }
        setIsPlaying(next);
        setTimelinePlaybackState(next, elapsed);
    }, [elapsed, isPlaying, setTimelinePlaybackState]);
    const handleSkipBack = useCallback(() => {
        setElapsed(0);
        if (showAudioEngine.hasTrack()) {
            showAudioEngine.pauseTrack();
            showAudioEngine.seekTrack(0);
        }
        setIsPlaying(false);
        setTimelinePlaybackState(false, 0);
    }, [setTimelinePlaybackState]);
    const handleSkipForward = useCallback(() => {
        const next = Math.min(elapsed + 10000, duration);
        setElapsed(next);
        if (showAudioEngine.hasTrack()) showAudioEngine.seekTrack(next);
        setTimelinePlaybackState(useStore.getState().timelinePlaying, next);
    }, [duration, elapsed, setTimelinePlaybackState]);

    // ── Master audio track (timeline clock) ────────────────────
    const handleLoadAudio = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            // Révoque l'objectURL précédent éventuel.
            if (audioObjectUrlRef.current) {
                try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch { /* noop */ }
                audioObjectUrlRef.current = null;
            }
            const url = URL.createObjectURL(file);
            audioObjectUrlRef.current = url;
            showAudioEngine.loadTrack(url).then(() => {
                if (showAudioEngine.hasTrack()) {
                    setAudioTrackName(file.name);
                    // Caler la timeline + l'audio sur le playhead courant.
                    showAudioEngine.seekTrack(elapsed);
                    const durMs = showAudioEngine.getAudioDurationMs();
                    if (durMs > 0) setDuration(durMs);
                } else {
                    // Load échoué : on nettoie, comportement = pas de piste.
                    if (audioObjectUrlRef.current) {
                        try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch { /* noop */ }
                        audioObjectUrlRef.current = null;
                    }
                    setAudioTrackName(null);
                    addToast?.({
                        type: 'error',
                        message: 'Audio illisible',
                        detail: 'Le fichier audio n\'a pas pu etre charge.',
                    });
                }
            });
        };
        input.click();
    }, [elapsed, setDuration, addToast]);

    const handleRemoveAudio = useCallback(() => {
        showAudioEngine.stopTrack();
        showAudioEngine.removeTrack();
        if (audioObjectUrlRef.current) {
            try { URL.revokeObjectURL(audioObjectUrlRef.current); } catch { /* noop */ }
            audioObjectUrlRef.current = null;
        }
        setAudioTrackName(null);
    }, []);

    // Fin de piste -> stop transport (sans casser le comportement sans piste).
    useEffect(() => {
        showAudioEngine.onTrackEnded(() => {
            setIsPlaying(false);
            setTimelinePlaybackState(false, showAudioEngine.getAudioPositionMs());
        });
        return () => { showAudioEngine.onTrackEnded(() => { /* noop */ }); };
    }, [setTimelinePlaybackState]);

    // ── Zoom (scroll wheel) + Shift = horizontal pan ─────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.shiftKey) {
            setFollowPlayhead(false);
            const panAmount = (e.deltaY > 0 ? 1 : -1) * viewDuration * 0.1;
            setViewStart(Math.max(0, Math.min(viewStart + panAmount, duration - viewDuration)));
        } else {
            const factor = e.deltaY < 0 ? 1.2 : 0.85;
            const newZoom = Math.max(1, Math.min(20, zoom * factor));
            setZoom(newZoom);
        }
    }, [zoom, setZoom, viewStart, viewDuration, duration, setViewStart]);

    const handleTapTempo = useCallback(() => {
        const now = performance.now();
        tapTimesRef.current = [...tapTimesRef.current, now].filter((time) => now - time < 4000).slice(-8);
        if (tapTimesRef.current.length < 2) return;
        const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
        const avg = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const nextBpm = Math.max(40, Math.min(240, Math.round((60000 / avg) * 10) / 10));
        setBpm(nextBpm);
        setBpmGridVisible(true);
    }, [setBpm, setBpmGridVisible]);

    // ── Ruler: click = playhead, right-click = marker, alt+drag = loop ──
    const getRulerMsFromClientX = useCallback((clientX: number) => {
        if (!rulerRef.current) return 0;
        const rect = rulerRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(snapMs(pxToMs(clientX - rect.left, rect.width)), duration));
    }, [duration, pxToMs, snapMs]);

    const getRulerMs = (e: React.MouseEvent) => getRulerMsFromClientX(e.clientX);

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (e.button === 2) {
            // Right-click → new marker
            setNewMarkerPending(getRulerMs(e));
            return;
        }
        const ms = getRulerMs(e);
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+drag (zone vide) → box-select de marqueurs (geste libre sur la règle)
            setMarkerBox({ startMs: ms, currentMs: ms });
            setSelectedMarkerIds(new Set());
            setRulerDragMode('box');
            return;
        }
        if (e.altKey) {
            // Alt+drag → loop region
            setRulerDragMode('loop');
            setLoopAnchorMs(ms);
            setLoopStart(ms);
            setLoopEnd(ms);
        } else {
            // Normal click -> set playhead
            setFollowPlayhead(false);
            setElapsed(ms);
            if (showAudioEngine.hasTrack()) showAudioEngine.seekTrack(ms);
            setRulerDragMode('playhead');
        }
    };

    const handleRulerMouseMove = useCallback((e: MouseEvent) => {
        if (!rulerDragMode || !rulerRef.current) return;
        const rect = rulerRef.current.getBoundingClientRect();
        const ms = Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration));
        if (rulerDragMode === 'playhead') {
            setElapsed(ms);
            if (showAudioEngine.hasTrack()) showAudioEngine.seekTrack(ms);
        }
        if (rulerDragMode === 'loop') {
            setLoopStart(Math.min(ms, loopAnchorMs));
            setLoopEnd(Math.max(ms, loopAnchorMs));
        }
        if (rulerDragMode === 'box') {
            setMarkerBox((prev) => {
                if (!prev) return prev;
                const lo = Math.min(prev.startMs, ms);
                const hi = Math.max(prev.startMs, ms);
                setSelectedMarkerIds(new Set(markers.filter((mk) => mk.time >= lo && mk.time <= hi).map((mk) => mk.id)));
                return { ...prev, currentMs: ms };
            });
        }
    }, [rulerDragMode, pxToMs, duration, loopAnchorMs, markers]);

    const handleRulerMouseUp = useCallback(() => {
        setRulerDragMode(null);
        setMarkerBox(null);
    }, []);

    useEffect(() => {
        if (rulerDragMode) {
            window.addEventListener('mousemove', handleRulerMouseMove);
            window.addEventListener('mouseup', handleRulerMouseUp);
            return () => { window.removeEventListener('mousemove', handleRulerMouseMove); window.removeEventListener('mouseup', handleRulerMouseUp); };
        }
    }, [rulerDragMode, handleRulerMouseMove, handleRulerMouseUp]);

    useEffect(() => {
        if (!draggingMarkerId) return;
        const handleMove = (event: MouseEvent) => {
            updateMarker(draggingMarkerId, { time: getRulerMsFromClientX(event.clientX) });
        };
        const handleUp = () => setDraggingMarkerId(null);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [draggingMarkerId, getRulerMsFromClientX, updateMarker]);

    // ── Group / duplicate marker drag (A4) ──
    // Pilote par groupDragRef. moveMarkers applique un delta unique a tous les ids
    // selectionnes (1 seul undo via coalesceKey du store). Snap calcule cote UI.
    useEffect(() => {
        if (!markerGroupDragActive) return;
        const handleMove = (event: MouseEvent) => {
            const g = groupDragRef.current;
            if (!g) return;
            const newAnchorMs = getRulerMsFromClientX(event.clientX);
            const delta = newAnchorMs - g.anchorStartMs;
            // ids cibles : copies si duplication, sinon la selection d'origine.
            const targetIds = g.duplicate && g.dupIds ? g.dupIds : g.ids;
            // Delta incrementiel (moveMarkers travaille sur l'etat courant).
            moveMarkers(targetIds, delta - g.lastDelta);
            g.lastDelta = delta;
        };
        const handleUp = () => {
            groupDragRef.current = null;
            setMarkerGroupDragActive(false);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [markerGroupDragActive, getRulerMsFromClientX, moveMarkers]);

    // ── Clip drag ──────────────────────────────────────────────
    const handleClipDragStart = (e: React.DragEvent, clip: TimelineClip) => {
        e.stopPropagation();
        if (!tracksBodyRef.current) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const clickMs = pxToMs(e.clientX - rect.left, rect.width);
        setDragOffsetMs(clickMs - clip.startTime);
        setDraggedClipId(clip.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleTrackDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

    const handleTrackDrop = (e: React.DragEvent, trackId: TimelineTrackId) => {
        e.preventDefault();
        if (!draggedClipId || !tracksBodyRef.current) return;
        const clip = clips.find(c => c.id === draggedClipId);
        if (!clip) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const dropMs = pxToMs(e.clientX - rect.left, rect.width);
        const primaryNewStart = snapMs(Math.max(0, Math.min(dropMs - dragOffsetMs, duration - clip.duration)));
        const deltaMs = primaryNewStart - clip.startTime;

        if (selectedClipIds.includes(draggedClipId) && selectedClipIds.length > 1) {
            // Move all selected clips by the same delta
            selectedClipIds.forEach(sid => {
                const sc = clips.find(x => x.id === sid);
                if (sc) {
                    const ns = snapMs(Math.max(0, Math.min(sc.startTime + deltaMs, duration - sc.duration)));
                    updateClip(sid, { startTime: ns, track: sid === draggedClipId ? trackId : sc.track });
                }
            });
        } else {
            updateClip(draggedClipId, { startTime: primaryNewStart, track: trackId });
        }
        setDraggedClipId(null);
    };

    // ── Resize ────────────────────────────────────────────────
    const handleResizeMouseDown = (e: React.MouseEvent, clipId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingClipId(clipId);
    };

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!resizingClipId || !tracksBodyRef.current) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const ms = Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration));
        const clip = clips.find(c => c.id === resizingClipId);
        const snapped = snapMs(ms);
        if (clip && snapped > clip.startTime + 1000) updateClip(resizingClipId, { duration: snapped - clip.startTime });
    }, [resizingClipId, clips, duration, pxToMs, snapMs, updateClip]);

    const handleResizeUp = () => setResizingClipId(null);

    useEffect(() => {
        if (resizingClipId) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeUp);
            return () => { window.removeEventListener('mousemove', handleResizeMove); window.removeEventListener('mouseup', handleResizeUp); };
        }
    }, [resizingClipId, handleResizeMove]);

    // ── Double-click track → new clip ─────────────────────────
    const handleTrackDoubleClick = (e: React.MouseEvent, track: TimelineTrackId) => {
        if (!tracksBodyRef.current) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const ms = snapMs(Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration - 10000)));
        setNewClipPending({ track, startTime: ms });
    };

    const confirmNewClip = (name: string, color: string, textColor: string) => {
        if (!newClipPending) return;
        addClip({
            id: `clip-${Date.now()}`,
            track: newClipPending.track,
            name,
            startTime: newClipPending.startTime,
            duration: 20000,
            color,
            textColor,
        });
        setNewClipPending(null);
    };

    const confirmNewMarker = (name: string, color: string) => {
        if (newMarkerPending === null) return;
        addMarker({ id: `mkr-${Date.now()}`, name, time: newMarkerPending, color });
        setNewMarkerPending(null);
    };

    const getAutomationValueFromClientY = useCallback((clientY: number) => {
        const y = Math.max(0, Math.min(clientY - keyframeLaneTopRef.current, LANE_H));
        return clampDmx(255 - (y / LANE_H) * 255);
    }, []);

    const getAutomationMsFromClientX = useCallback((clientX: number) => {
        if (!tracksBodyRef.current) return elapsed;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const timeAreaWidth = Math.max(1, rect.width - TRACK_LABEL_WIDTH_PX);
        const x = Math.max(0, Math.min(clientX - rect.left - TRACK_LABEL_WIDTH_PX, timeAreaWidth));
        const ms = viewStart + (x / timeAreaWidth) * viewDuration;
        return Math.max(0, Math.min(ms, duration));
    }, [duration, elapsed, viewDuration, viewStart]);

    const addKeyframeToTrack = useCallback((track: AutomationTrack, timeMs: number) => {
        const value = getAutomationValueAtTime(track, timeMs) ?? dmxEngine.getChannel(track.universe, track.channel);
        const keyframe = {
            id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timeMs,
            value,
            easing: 'linear' as AutomationEasing,
        };
        addAutomationKeyframe(track.id, keyframe);
        setSelectedAutomationTrackId(track.id);
        setSelectedKeyframe({ trackId: track.id, keyframeId: keyframe.id });
        setArrangementTab('automations');
    }, [addAutomationKeyframe]);

    const handleAutomationRowDoubleClick = (e: React.MouseEvent<HTMLDivElement>, track: AutomationTrack) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const timeMs = snapMs(viewStart + (x / Math.max(1, rect.width)) * viewDuration);
        addKeyframeToTrack(track, Math.max(0, Math.min(timeMs, duration)));
    };

    const handleKeyframeMouseDown = (e: React.MouseEvent, trackId: string, keyframeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedAutomationTrackId(trackId);
        setSelectedKeyframe({ trackId, keyframeId });
        keyframeLaneTopRef.current = e.currentTarget.parentElement?.getBoundingClientRect().top ?? e.clientY;
        setDraggingKeyframe({ trackId, keyframeId });
    };

    useEffect(() => {
        if (!draggingKeyframe) return;
        const handleMove = (e: MouseEvent) => {
            const updates = { value: getAutomationValueFromClientY(e.clientY), ...(e.shiftKey ? {} : { timeMs: snapMs(getAutomationMsFromClientX(e.clientX)) }) };
            updateAutomationKeyframe(draggingKeyframe.trackId, draggingKeyframe.keyframeId, updates);
        };
        const handleUp = () => setDraggingKeyframe(null);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [draggingKeyframe, getAutomationMsFromClientX, getAutomationValueFromClientY, snapMs, updateAutomationKeyframe]);

    useEffect(() => {
        if (!keyframeMenu) return;
        const closeMenu = () => setKeyframeMenu(null);
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu();
        };
        window.addEventListener('mousedown', closeMenu);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            window.removeEventListener('mousedown', closeMenu);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [keyframeMenu]);


    useEffect(() => {
        if (!markerEditor) return;
        const closeEditor = () => setMarkerEditor(null);
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeEditor();
        };
        window.addEventListener('mousedown', closeEditor);
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            window.removeEventListener('mousedown', closeEditor);
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [markerEditor]);
    const applyKeyframeEasing = (easing: AutomationEasing) => {
        if (!keyframeMenu) return;
        updateAutomationKeyframe(keyframeMenu.trackId, keyframeMenu.keyframeId, { easing });
        setSelectedKeyframe({ trackId: keyframeMenu.trackId, keyframeId: keyframeMenu.keyframeId });
        setKeyframeMenu(null);
    };

    const createAutomationTrack = () => {
        const channel = Math.min(512, automationTracks.length + 1);
        const color = AUTOMATION_COLORS[automationTracks.length % AUTOMATION_COLORS.length];
        const track: AutomationTrack = {
            id: `auto-${Date.now()}`,
            label: `Auto U1 CH${channel}`,
            fixtureId: `universe-1-channel-${channel}`,
            universe: 1,
            channel,
            channelType: 'dimmer',
            color,
            enabled: true,
            keyframes: [
                {
                    id: `kf-${Date.now()}`,
                    timeMs: Math.round(elapsed / 100) * 100,
                    value: dmxEngine.getChannel(1, channel),
                    easing: 'linear',
                },
            ],
        };
        addAutomationTrack(track);
        setSelectedAutomationTrackId(track.id);
        setSelectedKeyframe({ trackId: track.id, keyframeId: track.keyframes[0].id });
        setArrangementTab('automations');
    };

    const buildArrangementFromPads = () => {
        if (!smartPads.length) {
            addToast?.({
                type: 'warning',
                message: 'Aucun pad a arranger',
                detail: 'Creez ou importez des pads avant de generer la timeline.',
            });
            return;
        }

        if ((clips.length > 0 || markers.length > 0) && !window.confirm('Remplacer la timeline actuelle par un arrangement base sur les pads ?')) {
            return;
        }

        clips.forEach((clip) => deleteClip(clip.id));
        markers.forEach((marker) => deleteMarker(marker.id));

        const clipDuration = 30000;
        const totalDuration = Math.max(180000, smartPads.length * clipDuration);
        setDuration(totalDuration);
        setElapsed(0);
        setIsPlaying(false);
        setSelectedClipIds([]);

        smartPads.forEach((pad, index) => {
            addClip({
                id: `session-arr-${Date.now()}-${index}`,
                track: 'lights',
                name: pad.name.toUpperCase(),
                startTime: index * clipDuration,
                duration: clipDuration,
                color: pad.color,
                textColor: pad.textColor,
                qlcPage: pad.qlcPage,
                qlcWidget: pad.qlcWidget,
            });
        });

        [
            { name: 'INTRO', time: 0, color: '#22d3ee' },
            { name: 'BUILD', time: Math.min(clipDuration, totalDuration - 1000), color: '#fb923c' },
            { name: 'DROP', time: Math.min(clipDuration * 2, totalDuration - 1000), color: '#f43f5e' },
            { name: 'OUTRO', time: Math.max(0, totalDuration - clipDuration), color: '#a78bfa' },
        ].forEach((marker, index) => {
            addMarker({ id: `session-mkr-${Date.now()}-${index}`, ...marker });
        });

        socket.emit('timeline_log', {
            type: 'sys',
            text: `[Session] ${smartPads.length} pads convertis en arrangement.`,
        });
        addToast?.({
            type: 'success',
            message: 'Arrangement genere',
            detail: `${smartPads.length} clips crees depuis les pads session.`,
        });
    };

    // ── Ruler tick interval ────────────────────────────────────
    const tickIntervalMs = viewDuration <= 30000 ? 5000
        : viewDuration <= 120000 ? 15000
        : viewDuration <= 300000 ? 30000
        : 60000;

    if (!isTimelineVisible) return null;

    const playheadPct = msToPct(elapsed);
    const loopStartPct = loopStart !== null ? msToPct(loopStart) : null;
    const loopEndPct = loopEnd !== null ? msToPct(loopEnd) : null;

    return (
        <>
            {newClipPending && (
                <NewClipModal
                    track={newClipPending.track}
                    startTime={newClipPending.startTime}
                    onConfirm={confirmNewClip}
                    onCancel={() => setNewClipPending(null)}
                />
            )}
            {newMarkerPending !== null && (
                <NewMarkerModal
                    time={newMarkerPending}
                    onConfirm={confirmNewMarker}
                    onCancel={() => setNewMarkerPending(null)}
                />
            )}
            {keyframeMenu && (
                <div
                    className="fixed z-[120] w-36 rounded-lg border border-white/10 bg-[#111318] p-1 shadow-2xl"
                    style={{ left: keyframeMenu.x, top: keyframeMenu.y }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    {(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'] as AutomationEasing[]).map((easing) => (
                        <button
                            key={easing}
                            type="button"
                            onClick={() => applyKeyframeEasing(easing)}
                            className="block w-full rounded px-2 py-1 text-left text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
                        >
                            {easing}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            deleteAutomationKeyframe(keyframeMenu.trackId, keyframeMenu.keyframeId);
                            setSelectedKeyframe(null);
                            setKeyframeMenu(null);
                        }}
                        className="mt-1 block w-full rounded border-t border-white/10 px-2 py-1 text-left text-[10px] font-bold text-red-300 hover:bg-red-500/10"
                    >
                        Supprimer
                    </button>
                </div>
            )}

            {markerEditor && (() => {
                const marker = markers.find((candidate) => candidate.id === markerEditor.id);
                if (!marker) return null;
                return (
                    <div
                        className="fixed z-[120] w-52 rounded-lg border border-white/10 bg-[#111318] p-2 shadow-2xl"
                        style={{ left: markerEditor.x, top: markerEditor.y }}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <label className="mb-2 block text-[8px] font-black uppercase tracking-widest text-slate-500">Marker</label>
                        <input
                            value={marker.name}
                            onChange={(event) => updateMarker(marker.id, { name: event.target.value })}
                            className="mb-2 w-full rounded border border-white/10 bg-[#101218] px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-yellow-400/50"
                        />
                        <div className="flex flex-wrap gap-1">
                            {MARKER_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateMarker(marker.id, { color })}
                                    className={`h-5 w-5 rounded-full border transition-transform ${marker.color === color ? 'scale-110 border-white' : 'border-white/10 hover:scale-105'}`}
                                    style={{ background: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                );
            })()}
            {/* ── Drag Handle ── */}
            <div
                className={`relative h-1.5 bg-[#12141A] border-t border-slate-700 cursor-ns-resize flex items-center justify-center group/handle z-40 shrink-0 ${isResizingPanel ? 'bg-cyan-500/10' : 'hover:bg-cyan-500/5'}`}
                onMouseDown={handlePanelResizeStart}
                onDoubleClick={() => setTimelineHeight(timelineHeight <= 150 ? 288 : 120)}
            >
                <GripHorizontal className={`w-5 h-3 transition-colors ${isResizingPanel ? 'text-cyan-400' : 'text-slate-600 group-hover/handle:text-cyan-400'}`} />
            </div>

            <div className="macro-timeline-container relative bg-[#12141A] border-t border-slate-800 z-40 flex shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 select-none" style={{ height: timelineHeight }}>

                {/* ===== Timeline Panel ===== */}
                <div className="flex-1 flex flex-col border-r border-[#262c36] p-2 overflow-hidden">

                    {/* Controls bar */}
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                        <h3 className="text-cyan-400 font-bold text-[10px] tracking-widest uppercase mr-1">Timeline</h3>

                        {/* Transport */}
                        <button onClick={handleSkipBack} title="Début" className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-300">
                            <SkipBack className="w-3 h-3" />
                        </button>
                        <button onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-black transition-all ${isPlaying ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-cyan-500 hover:bg-cyan-400'}`}>
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                        <button onClick={handleSkipForward} title="+10s" className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors text-slate-300">
                            <SkipForward className="w-3 h-3" />
                        </button>

                        {/* Timecode */}
                        <span className="text-slate-400 font-mono text-[10px] font-bold bg-[#1a1c23] px-2 py-0.5 rounded-full border border-[#262c36] tabular-nums">
                            {formatTime(elapsed)} / {formatTime(duration)}
                        </span>

                        {automationRecArmed && (
                            <span className="rounded-full border border-red-500/35 bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-300 animate-pulse">
                                REC AUTO
                            </span>
                        )}

                        <button
                            onClick={buildArrangementFromPads}
                            title="Generer un arrangement depuis les pads session"
                            className="timeline-arrangement-generate-button h-6 px-2 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-colors text-[9px] font-black uppercase tracking-wider"
                        >
                            Pads -&gt; Arrangement
                        </button>
                        <button
                            onClick={createAutomationTrack}
                            title="Ajouter une piste automation DMX"
                            className="timeline-auto-track-button h-6 px-2 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 transition-colors text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                        >
                            <SlidersHorizontal className="w-3 h-3" /> Auto
                        </button>

                        {/* Master audio track (horloge timeline) */}
                        {audioTrackName === null ? (
                            <button
                                onClick={handleLoadAudio}
                                title="Charger une piste audio maitre (horloge timeline)"
                                className="timeline-load-audio-button h-6 px-2 rounded bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 transition-colors text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                            >
                                <Music className="w-3 h-3" /> Audio
                            </button>
                        ) : (
                            <div className="flex items-center gap-1 h-6 px-2 rounded bg-blue-500/15 border border-blue-500/30 text-blue-200">
                                <Music className="w-3 h-3 flex-shrink-0" />
                                <span className="text-[9px] font-bold max-w-[120px] truncate" title={audioTrackName}>{audioTrackName}</span>
                                <button
                                    onClick={handleRemoveAudio}
                                    title="Retirer la piste audio"
                                    className="ml-0.5 text-blue-300 hover:text-red-300 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <div className="flex-1" />

                        {/* Loop */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsLoopEnabled(p => !p)}
                                title={loopStart !== null ? 'Toggle loop' : 'Alt+drag ruler pour definir la zone'}
                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all ${isLoopEnabled && loopStart !== null
                                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                            >
                                LOOP
                            </button>
                            {loopStart !== null && loopEnd !== null && (
                                <div className="flex items-center gap-1 rounded border border-green-500/20 bg-green-500/5 px-1 py-0.5">
                                    <input
                                        aria-label="Loop in"
                                        value={formatTime(loopStart)}
                                        onChange={(event) => {
                                            const next = parseTimeInput(event.target.value);
                                            if (next !== null) setLoopStart(Math.min(next, loopEnd));
                                        }}
                                        className="w-14 bg-transparent text-[8px] font-mono text-green-300 outline-none"
                                    />
                                    <span className="text-[8px] text-green-500">-</span>
                                    <input
                                        aria-label="Loop out"
                                        value={formatTime(loopEnd)}
                                        onChange={(event) => {
                                            const next = parseTimeInput(event.target.value);
                                            if (next !== null) setLoopEnd(Math.max(next, loopStart));
                                        }}
                                        className="w-14 bg-transparent text-[8px] font-mono text-green-300 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="w-px h-5 bg-slate-800" />

                        <button
                            onClick={() => setFollowPlayhead(!followPlayhead)}
                            title="Suivre le playhead"
                            className={`text-[9px] font-bold px-2 py-1 rounded border transition-all flex items-center gap-1 ${followPlayhead ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'text-slate-500 border-slate-700 hover:text-slate-300'}`}
                        >
                            <Crosshair className="w-3 h-3" /> FOLLOW
                        </button>
                        {/* Snap */}
                        <button
                            onClick={() => setSnapEnabled(!snapEnabled)}
                            title="Snap-to-grid"
                            className={`text-[9px] font-bold px-2 py-1 rounded border transition-all flex items-center gap-1 ${snapEnabled
                                ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                        >
                            <Magnet className="w-3 h-3" /> SNAP
                        </button>

                        {/* BPM Grid */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setBpmGridVisible(!bpmGridVisible)}
                                title={bpm > 0 ? `BPM Grid (${bpm} BPM)` : 'Set BPM first'}
                                className={`text-[9px] font-bold px-2 py-1 rounded border transition-all flex items-center gap-1 ${bpmGridVisible && bpm > 0
                                    ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                            >
                                <Music className="w-3 h-3" /> BPM
                            </button>
                            <input
                                type="number"
                                min={40}
                                max={240}
                                step={0.1}
                                value={bpm}
                                onChange={(event) => setBpm(Math.max(40, Math.min(240, Number(event.target.value) || bpm)))}
                                className="h-6 w-14 rounded border border-slate-700 bg-slate-900 px-1 text-center text-[9px] font-bold tabular-nums text-orange-300 outline-none focus:border-orange-400/50"
                                title="BPM"
                            />
                            <button
                                onClick={handleTapTempo}
                                className="h-6 rounded border border-slate-700 bg-slate-800 px-2 text-[8px] font-black uppercase text-slate-400 hover:text-orange-300"
                                title="Tap tempo"
                            >
                                TAP
                            </button>
                        </div>

                        <div className="w-px h-5 bg-slate-800" />
                        {/* Zoom */}
                        <button onClick={() => setZoom(Math.max(1, zoom / 1.4))} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400 transition-colors">
                            <ZoomOut className="w-3 h-3" />
                        </button>
                        <span className="text-[9px] text-slate-500 w-10 text-center tabular-nums">{zoom.toFixed(1)}x</span>
                        <button onClick={() => setZoom(Math.min(20, zoom * 1.4))} className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400 transition-colors">
                            <ZoomIn className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Timeline canvas */}
                    <div className="flex-1 bg-[#1a1c23] rounded-lg border border-[#262c36] flex flex-col overflow-hidden" onWheel={handleWheel}>

                        {/* ── Ruler ── */}
                        <div
                            ref={rulerRef}
                            className="h-7 flex-shrink-0 bg-[#0f1116] border-b border-[#262c36] relative cursor-crosshair select-none"
                            onMouseDown={handleRulerMouseDown}
                            onContextMenu={e => e.preventDefault()}
                        >
                            {/* Loop region */}
                            {loopStartPct !== null && loopEndPct !== null && (
                                <div
                                    className="absolute top-0 bottom-0 bg-green-500/10 border-x border-green-500/30 pointer-events-none"
                                    style={{ left: `${loopStartPct}%`, width: `${loopEndPct - loopStartPct}%` }}
                                />
                            )}

                            {/* Box-select region (Ctrl/Cmd+drag) */}
                            {markerBox && (() => {
                                const a = msToPct(Math.min(markerBox.startMs, markerBox.currentMs));
                                const b = msToPct(Math.max(markerBox.startMs, markerBox.currentMs));
                                return (
                                    <div
                                        className="absolute top-0 bottom-0 bg-yellow-400/15 border-x border-yellow-400/50 pointer-events-none z-30"
                                        style={{ left: `${a}%`, width: `${Math.max(0, b - a)}%` }}
                                    />
                                );
                            })()}

                            {/* Tick marks */}
                            {Array.from({ length: Math.floor(viewDuration / tickIntervalMs) + 2 }).map((_, i) => {
                                const tickMs = Math.ceil(viewStart / tickIntervalMs) * tickIntervalMs + i * tickIntervalMs;
                                if (tickMs > viewEnd + tickIntervalMs) return null;
                                const pct = msToPct(tickMs);
                                return (
                                    <div key={tickMs} className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ left: `${pct}%` }}>
                                        <div className="w-px h-2.5 bg-slate-600" />
                                        <span className="text-[7px] text-slate-500 mt-0.5 -translate-x-1/2">{formatTime(tickMs)}</span>
                                    </div>
                                );
                            })}

                            {/* Cue Markers */}
                            {markers.map(m => {
                                const pct = msToPct(m.time);
                                if (pct < -1 || pct > 101) return null;
                                const isSelected = selectedMarkerIds.has(m.id);
                                return (
                                    <div
                                        key={m.id}
                                        className={`absolute top-0 flex flex-col items-center group/marker z-10 cursor-ew-resize ${isSelected ? 'ring-1 ring-yellow-400/80 rounded-sm bg-yellow-400/10' : ''}`}
                                        style={{ left: `${pct}%` }}
                                        onMouseDown={(event) => {
                                            if ((event.target as HTMLElement).closest('button')) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            // Shift+clic = toggle selection (pas de drag).
                                            if (event.shiftKey) {
                                                setSelectedMarkerIds((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                                                    return next;
                                                });
                                                return;
                                            }
                                            const inGroup = selectedMarkerIds.has(m.id) && selectedMarkerIds.size > 1;
                                            const duplicate = event.altKey;
                                            // Drag de GROUPE (marqueur deja selectionne dans un groupe), ou DUPLICATION (Alt) :
                                            if (inGroup || duplicate) {
                                                const ids = (selectedMarkerIds.has(m.id) && selectedMarkerIds.size > 0)
                                                    ? Array.from(selectedMarkerIds)
                                                    : [m.id];
                                                let dupIds: string[] | null = null;
                                                if (duplicate) {
                                                    // Cree des copies a la meme position, qui suivront le drag.
                                                    const stamp = Date.now();
                                                    const copies = ids
                                                        .map((id) => markers.find((mk) => mk.id === id))
                                                        .filter((mk): mk is CueMarker => !!mk)
                                                        .map((mk, i) => ({
                                                            ...mk,
                                                            id: `mkr-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                                                        }));
                                                    dupIds = copies.map((c) => c.id);
                                                    addMarkers(copies);
                                                    setSelectedMarkerIds(new Set(dupIds));
                                                }
                                                groupDragRef.current = {
                                                    anchorId: m.id,
                                                    anchorStartMs: m.time,
                                                    ids,
                                                    duplicate,
                                                    dupIds,
                                                    lastDelta: 0,
                                                };
                                                setMarkerGroupDragActive(true);
                                                return;
                                            }
                                            // Sinon : selection simple + drag single (comportement inchange).
                                            if (!selectedMarkerIds.has(m.id)) setSelectedMarkerIds(new Set([m.id]));
                                            setDraggingMarkerId(m.id);
                                        }}
                                        onDoubleClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setMarkerEditor({ id: m.id, x: event.clientX, y: event.clientY });
                                        }}
                                    >
                                        <div className="w-px h-full" style={{ background: m.color }} />
                                        <div
                                            className="absolute top-0 flex items-center gap-0.5 -translate-x-1/2"
                                            style={{ color: m.color }}
                                        >
                                            <Flag className="w-2 h-2 fill-current" />
                                            <span className="text-[7px] font-bold whitespace-nowrap">{m.name}</span>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteMarker(m.id); }}
                                            className="absolute top-0 right-0 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-red-500 rounded-full p-px"
                                            title="Supprimer marker"
                                        >
                                            <X className="w-2 h-2 text-white" />
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Playhead triangle */}
                            <div
                                className="absolute top-0 z-20 pointer-events-none"
                                style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}
                            >
                                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-500" />
                            </div>
                        </div>

                        {/* ── Waveform lane (additive, SOUS la règle) — visible uniquement si piste audio chargée ── */}
                        {showAudioEngine.hasTrack() && (
                            <div className="flex-shrink-0 flex border-b border-[#262c36] bg-[#0a0c10]">
                                {/* Colonne de label alignée sur les pistes (56px) */}
                                <span className="text-[8px] text-slate-500 font-bold uppercase w-14 flex-shrink-0 flex items-center justify-end pr-2 border-r border-[#262c36]">
                                    WAVE
                                </span>
                                {/* Zone temps : même mapping viewStart/viewEnd que clips/règle */}
                                <div className="flex-1 relative overflow-hidden">
                                    <WaveformView
                                        positionMs={elapsed}
                                        viewStartMs={viewStart}
                                        viewEndMs={viewEnd}
                                        durationMs={duration}
                                        heightPx={40}
                                        audioUrl={audioObjectUrlRef.current}
                                        onSeek={(ms) => {
                                            setElapsed(ms);
                                            if (showAudioEngine.hasTrack()) showAudioEngine.seekTrack(ms);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Tracks body ── */}
                        <div ref={tracksBodyRef} className="flex-1 relative flex flex-col overflow-y-auto">
                            {/* BPM grid lines */}
                            {bpmGridVisible && bpm > 0 && (() => {
                                const beatMs = 60000 / bpm;
                                const barMs = beatMs * 4;
                                const lines: React.ReactNode[] = [];
                                const firstBeat = Math.ceil(viewStart / beatMs) * beatMs;
                                for (let t = firstBeat; t <= viewEnd + beatMs; t += beatMs) {
                                    const pct = msToPct(t);
                                    if (pct < -1 || pct > 101) continue;
                                    const isBar = Math.abs(t % barMs) < 1;
                                    lines.push(
                                        <div key={`bpm-${t}`} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pct}%`, width: '1px', background: isBar ? 'rgba(251,146,60,0.25)' : 'rgba(251,146,60,0.1)' }} />
                                    );
                                }
                                return lines;
                            })()}

                            {/* Playhead line through tracks */}
                            {playheadPct >= 0 && playheadPct <= 100 && (
                                <div
                                    className="absolute top-0 bottom-0 w-px bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-20 pointer-events-none"
                                    style={{ left: `${playheadPct}%` }}
                                />
                            )}

                            {TRACKS.map(track => (
                                <div
                                    key={track}
                                    className="h-12 shrink-0 border-b border-[#262c36] flex overflow-hidden"
                                    onDragOver={handleTrackDragOver}
                                    onDrop={(e) => handleTrackDrop(e, track)}
                                    onDoubleClick={(e) => handleTrackDoubleClick(e, track)}
                                >
                                    {/* Track label */}
                                    <span className="text-[8px] text-slate-500 font-bold uppercase w-14 flex-shrink-0 flex items-center justify-end pr-2 border-r border-[#262c36]">
                                        {TRACK_LABELS[track]}
                                    </span>

                                    {/* Clip area */}
                                    <div className="flex-1 relative">
                                        {clips.filter(c => c.track === track).map(clip => {
                                            const left = msToPct(clip.startTime);
                                            const right = msToPct(clip.startTime + clip.duration);
                                            const width = right - left;
                                            if (right < 0 || left > 100) return null;

                                            const isSelected = selectedClipIds.includes(clip.id);
                                            return (
                                                <div
                                                    key={clip.id}
                                                    draggable
                                                    onDragStart={(e) => handleClipDragStart(e, clip)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (e.shiftKey) {
                                                            setSelectedClipIds(prev => prev.includes(clip.id) ? prev.filter(x => x !== clip.id) : [...prev, clip.id]);
                                                        } else {
                                                            setSelectedClipIds([clip.id]);
                                                        }
                                                    }}
                                                    className={`timeline-clip absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 text-[8px] font-bold overflow-hidden cursor-grab active:cursor-grabbing group/clip select-none border ${clip.textColor} ${isSelected ? 'ring-1 ring-white/70 border-white/40' : 'border-white/10'}`}
                                                    style={{
                                                        left: `${Math.max(0, left)}%`,
                                                        width: `${Math.min(width, 100 - Math.max(0, left))}%`,
                                                    }}
                                                >
                                                    {/* Colored fill */}
                                                    <div className={`absolute inset-0 rounded ${clip.color} opacity-20`} />
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${clip.color}`} />

                                                    <span className="relative z-10 truncate ml-1">{clip.name}</span>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); deleteClip(clip.id); }}
                                                        className="absolute right-4 top-0.5 opacity-0 group-hover/clip:opacity-100 transition-opacity bg-red-500 rounded p-px"
                                                    >
                                                        <X className="w-2 h-2 text-white" />
                                                    </button>

                                                    {/* Resize handle */}
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover/clip:opacity-100 bg-white/20 rounded-r transition-opacity"
                                                        onMouseDown={e => handleResizeMouseDown(e, clip.id)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {automationTracks.map(track => {
                                const isRecTarget = automationRecArmed
                                    && recTargetFixtureId === track.fixtureId
                                    && (track.channelType === 'pan' || track.channelType === 'tilt');
                                return (
                                <div
                                    key={track.id}
                                    className={`timeline-automation-lane h-9 shrink-0 flex border-b overflow-hidden ${isRecTarget ? 'border-red-500/40 bg-red-500/[0.08]' : 'border-[#262c36]'} ${selectedAutomationTrack?.id === track.id ? 'bg-white/[0.035]' : ''}`}
                                    onClick={() => {
                                        setSelectedAutomationTrackId(track.id);
                                        setArrangementTab('automations');
                                    }}
                                >
                                    <span className="text-[8px] text-slate-500 font-bold uppercase w-14 flex-shrink-0 flex items-center gap-1 justify-end pr-2 border-r border-[#262c36]">
                                        <span className="h-2 w-2 rounded-full" style={{ background: track.color }} />
                                        <span className="max-w-[36px] truncate">{track.label.replace(/^Auto\s*/i, '')}</span>
                                    </span>
                                    <div
                                        className="flex-1 relative cursor-crosshair"
                                        onDoubleClick={(e) => handleAutomationRowDoubleClick(e, track)}
                                        title="Double-clic pour poser une keyframe"
                                    >
                                        {/* Automation curve SVG */}
                                        {track.keyframes.length >= 2 && (
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                                                {(() => {
                                                    const sorted = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
                                                    const points: string[] = [];
                                                    const fillPoints: string[] = [];
                                                    const h = LANE_H;
                                                    for (let i = 0; i < sorted.length; i++) {
                                                        const kf = sorted[i];
                                                        const next = sorted[i + 1];
                                                        const x = msToPct(kf.timeMs);
                                                        const y = h - (kf.value / 255) * (h - 4) - 2;
                                                        points.push(`${x},${y}`);
                                                        fillPoints.push(`${x},${y}`);
                                                        if (next && kf.easing !== 'linear' && kf.easing !== 'hold') {
                                                            const steps = 8;
                                                            for (let s = 1; s < steps; s++) {
                                                                const t = s / steps;
                                                                const eased = applyEasing(t, kf.easing ?? 'linear');
                                                                const ix = x + (msToPct(next.timeMs) - x) * t;
                                                                const iv = kf.value + (next.value - kf.value) * eased;
                                                                const iy = h - (iv / 255) * (h - 4) - 2;
                                                                points.push(`${ix},${iy}`);
                                                                fillPoints.push(`${ix},${iy}`);
                                                            }
                                                        }
                                                        if (next && kf.easing === 'hold') {
                                                            const nx = msToPct(next.timeMs);
                                                            points.push(`${nx},${y}`);
                                                            fillPoints.push(`${nx},${y}`);
                                                        }
                                                    }
                                                    const firstX = msToPct(sorted[0].timeMs);
                                                    const lastX = msToPct(sorted[sorted.length - 1].timeMs);
                                                    const fillPath = `${fillPoints.join(' ')} ${lastX},${h} ${firstX},${h}`;
                                                    return (
                                                        <>
                                                            <polygon points={fillPath} fill={track.color} opacity="0.08" vectorEffect="non-scaling-stroke" />
                                                            <polyline points={points.join(' ')} fill="none" stroke={track.color} strokeWidth="1.5" opacity="0.6" vectorEffect="non-scaling-stroke" />
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        )}
                                        {(() => {
                                            const sortedKeyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);
                                            const timeAreaWidth = Math.max(1, tracksBodyWidth - TRACK_LABEL_WIDTH_PX);
                                            let nextVisibleIndex = 0;
                                            return sortedKeyframes.map((keyframe, index) => {
                                                if (index < nextVisibleIndex) return null;
                                                const pct = msToPct(keyframe.timeMs);
                                                if (pct < -1 || pct > 101) return null;
                                                let cursor = index + 1;
                                                while (cursor < sortedKeyframes.length) {
                                                    const gapPx = Math.abs(msToPct(sortedKeyframes[cursor].timeMs) - pct) * timeAreaWidth / 100;
                                                    if (gapPx >= 6) break;
                                                    cursor += 1;
                                                }
                                                nextVisibleIndex = cursor;
                                                const clusterCount = cursor - index;
                                                const selected = selectedKeyframe?.trackId === track.id && selectedKeyframe.keyframeId === keyframe.id;
                                                if (clusterCount > 1) {
                                                    return (
                                                        <button
                                                            key={`cluster-${track.id}-${keyframe.id}`}
                                                            onMouseDown={(e) => handleKeyframeMouseDown(e, track.id, keyframe.id)}
                                                            className="absolute h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 bg-slate-950 px-1 text-[8px] font-black text-white shadow"
                                                            style={{ left: `${pct}%`, top: `${100 - (keyframe.value / 255) * 100}%`, borderColor: track.color }}
                                                            title={`${clusterCount} keyframes proches`}
                                                        >
                                                            +{clusterCount}
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        key={keyframe.id}
                                                        onMouseDown={(e) => handleKeyframeMouseDown(e, track.id, keyframe.id)}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setSelectedAutomationTrackId(track.id);
                                                            setSelectedKeyframe({ trackId: track.id, keyframeId: keyframe.id });
                                                            setKeyframeMenu({ trackId: track.id, keyframeId: keyframe.id, x: e.clientX, y: e.clientY });
                                                        }}
                                                        className={`absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-all z-10 ${selected ? 'border-white scale-125' : 'border-black/60 hover:scale-110'}`}
                                                        style={{ left: `${pct}%`, top: `${100 - (keyframe.value / 255) * 100}%`, background: track.color }}
                                                        title={`${track.label} - ${formatTime(keyframe.timeMs)} - ${keyframe.value} - ${keyframe.easing ?? 'linear'}`}
                                                    />
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Minimap */}
                    <div className="relative h-5 bg-[#0a0b0f] border-t border-slate-800 flex-shrink-0 cursor-pointer"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pct = (e.clientX - rect.left) / rect.width;
                            const newStart = Math.max(0, Math.min(pct * duration - viewDuration / 2, duration - viewDuration));
                            setFollowPlayhead(false);
                            setViewStart(newStart);
                        }}>
                        {clips.map(clip => {
                            const left = (clip.startTime / duration) * 100;
                            const width = Math.max(0.5, (clip.duration / duration) * 100);
                            const colors: Record<TimelineTrackId, string> = { lights: '#22d3ee', visuals: '#a78bfa', fx: '#f59e0b' };
                            return <div key={clip.id} className="absolute top-0.5 bottom-0.5 rounded-sm opacity-90" style={{ left: `${left}%`, width: `${width}%`, background: colors[clip.track] ?? '#22d3ee' }} />;
                        })}
                        {markers.map(m => (
                            <div key={m.id} className="absolute top-0 bottom-0 w-px bg-yellow-400/40" style={{ left: `${(m.time / duration) * 100}%` }} />
                        ))}
                        <div className="absolute top-0 bottom-0 border border-cyan-400/70 bg-cyan-400/10 rounded-sm" style={{ left: `${(viewStart / duration) * 100}%`, width: `${(viewDuration / duration) * 100}%` }} />
                        <div className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: `${(elapsed / duration) * 100}%` }} />
                    </div>

                    {/* Hints */}
                    <p className="text-[8px] text-slate-600 mt-1 flex-shrink-0">
                        Clic règle = playhead · Clic droit = marker · Alt+drag = loop · Double-clic piste = créer clip · Shift+clic = multi-select · Ctrl+C/V = copier · Suppr = effacer · Scroll = zoom · Shift+scroll = pan · Snap = magnétisme grille · Ctrl+drag règle = box-select markers · Shift+clic marker = (dé)sélection · Drag groupe = déplacer · Alt+drag marker = dupliquer · Échap = désélectionner
                    </p>
                </div>

                {/* ===== Arrangement Tools ===== */}
                <div className="w-[420px] flex flex-col p-2.5 bg-[#12141A]">
                    <div className="flex items-center gap-1 border-b border-[#262c36] pb-1.5 mb-2">
                        {[
                            { id: 'scenes', label: 'Scenes' },
                            { id: 'cues', label: 'Cues' },
                            { id: 'chasers', label: 'Chasers' },
                            { id: 'automations', label: 'Auto' },
                            { id: 'visualizer', label: '3D' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setArrangementTab(tab.id as typeof arrangementTab)}
                                className={`timeline-tab-${tab.id} h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                                    arrangementTab === tab.id
                                        ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                                        : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                        <div className="flex-1" />
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                        {arrangementTab === 'scenes' && <SceneClipPanel />}
                        {arrangementTab === 'cues' && <CueClipPanel />}
                        {arrangementTab === 'chasers' && <ChaserTrackPanel />}
                        {arrangementTab === 'visualizer' && (
                            <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-lg border border-purple-500/20 bg-black/30">
                                <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/5 px-2">
                                    <Box className="h-3.5 w-3.5 text-purple-300" />
                                    <h3 className="min-w-0 flex-1 text-[9px] font-black uppercase tracking-widest text-purple-200">
                                        Vue 3D Live
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProView('visualizer');
                                            setArrangementTab('scenes');
                                        }}
                                        className="flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[8px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:border-purple-500/35 hover:text-purple-200"
                                        title="Detacher en grande vue"
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                        Detacher
                                    </button>
                                </div>
                                <div className="min-h-0 flex-1">
                                    <VisualizerView />
                                </div>
                            </div>
                        )}
                        {arrangementTab === 'automations' && (
                            <div className="timeline-automation-panel space-y-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-slate-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                                        <SlidersHorizontal className="w-3 h-3 text-emerald-400" />Automations DMX
                                    </h3>
                                    <div className="flex-1" />
                                    <button
                                        onClick={createAutomationTrack}
                                        className="h-6 px-2 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[9px] font-black uppercase"
                                    >
                                        + Track
                                    </button>
                                </div>

                                {selectedAutomationTrack && selectedAutomationKeyframe && (
                                    <div className="border border-white/10 rounded-lg bg-black/20 p-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-white flex-1">
                                                Keyframe {selectedAutomationTrack.label}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    deleteAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id);
                                                    setSelectedKeyframe(null);
                                                }}
                                                className="text-red-300 hover:text-red-200"
                                                title="Supprimer keyframe"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <label className="grid grid-cols-[54px_1fr_56px] items-center gap-2 text-[9px] text-slate-400">
                                            Temps
                                            <input
                                                type="range"
                                                min={0}
                                                max={duration}
                                                step={100}
                                                value={selectedAutomationKeyframe.timeMs}
                                                onChange={(e) => updateAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id, { timeMs: Number(e.target.value) })}
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                max={Math.ceil(duration / 1000)}
                                                step={0.1}
                                                value={Math.round(selectedAutomationKeyframe.timeMs / 100) / 10}
                                                onChange={(e) => updateAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id, { timeMs: Math.max(0, Math.min(duration, Number(e.target.value) * 1000)) })}
                                                className="bg-[#101218] border border-white/10 rounded px-1 py-0.5 text-slate-200"
                                            />
                                        </label>
                                        <label className="grid grid-cols-[54px_1fr_44px] items-center gap-2 text-[9px] text-slate-400">
                                            Valeur
                                            <input
                                                type="range"
                                                min={0}
                                                max={255}
                                                value={selectedAutomationKeyframe.value}
                                                onChange={(e) => updateAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id, { value: clampDmx(Number(e.target.value)) })}
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                max={255}
                                                value={selectedAutomationKeyframe.value}
                                                onChange={(e) => updateAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id, { value: clampDmx(Number(e.target.value)) })}
                                                className="bg-[#101218] border border-white/10 rounded px-1 py-0.5 text-slate-200"
                                            />
                                        </label>
                                        <label className="grid grid-cols-[54px_1fr] items-center gap-2 text-[9px] text-slate-400">
                                            Easing
                                            <select
                                                value={selectedAutomationKeyframe.easing ?? 'linear'}
                                                onChange={(e) => updateAutomationKeyframe(selectedAutomationTrack.id, selectedAutomationKeyframe.id, { easing: e.target.value as AutomationEasing })}
                                                className="bg-[#101218] border border-white/10 rounded px-2 py-1 text-slate-200"
                                            >
                                                {(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'] as AutomationEasing[]).map((easing) => (
                                                    <option key={easing} value={easing}>{easing}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    {automationTracks.length === 0 && (
                                        <p className="text-[10px] text-slate-500 border border-dashed border-white/10 rounded-lg p-3">
                                            Aucune automation. Creez une piste puis double-cliquez dans la lane AUTO pour poser des keyframes.
                                        </p>
                                    )}
                                    {automationTracks.map(track => {
                                        const isExpanded = expandedTrackId === track.id;
                                        const isSelected = selectedAutomationTrack?.id === track.id;
                                        return (
                                            <div
                                                key={track.id}
                                                className={`border rounded-lg p-2 space-y-2 ${isSelected ? 'border-emerald-500/35 bg-emerald-500/[0.04]' : 'border-white/10 bg-black/15'}`}
                                                onClick={() => setSelectedAutomationTrackId(track.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedTrackId(isExpanded ? null : track.id);
                                                        }}
                                                        className="text-slate-500 hover:text-slate-200"
                                                        title={isExpanded ? 'Replier' : 'Details'}
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    </button>
                                                    <input
                                                        type="checkbox"
                                                        checked={track.enabled}
                                                        onChange={(e) => updateAutomationTrack(track.id, { enabled: e.target.checked })}
                                                        className="accent-emerald-400"
                                                    />
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: track.color }} />
                                                    <input
                                                        value={track.label}
                                                        onChange={(e) => updateAutomationTrack(track.id, { label: e.target.value })}
                                                        className="min-w-0 flex-1 bg-[#101218] border border-white/10 rounded px-2 py-1 text-[10px] text-white"
                                                    />
                                                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-black text-slate-500">
                                                        {track.keyframes.length} KF
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addKeyframeToTrack(track, snapMs(elapsed));
                                                        }}
                                                        className="h-6 px-2 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[9px] font-bold"
                                                    >
                                                        KF
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteAutomationTrack(track.id);
                                                            if (selectedAutomationTrackId === track.id) setSelectedAutomationTrackId(null);
                                                            if (selectedKeyframe?.trackId === track.id) setSelectedKeyframe(null);
                                                        }}
                                                        className="text-red-300 hover:text-red-200"
                                                        title="Supprimer piste"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <>
                                                        <div className="grid grid-cols-[1fr_1fr_1.2fr_36px] gap-1.5">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={track.universe}
                                                                onChange={(e) => updateAutomationTrack(track.id, { universe: Math.max(1, Number(e.target.value)) })}
                                                                className="bg-[#101218] border border-white/10 rounded px-2 py-1 text-[10px] text-slate-200"
                                                                title="Univers"
                                                            />
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={512}
                                                                value={track.channel}
                                                                onChange={(e) => updateAutomationTrack(track.id, { channel: Math.max(1, Math.min(512, Number(e.target.value))) })}
                                                                className="bg-[#101218] border border-white/10 rounded px-2 py-1 text-[10px] text-slate-200"
                                                                title="Canal"
                                                            />
                                                            <select
                                                                value={track.channelType}
                                                                onChange={(e) => updateAutomationTrack(track.id, { channelType: e.target.value as AutomationChannelType })}
                                                                className="bg-[#101218] border border-white/10 rounded px-2 py-1 text-[10px] text-slate-200"
                                                            >
                                                                {AUTOMATION_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                                            </select>
                                                            <input
                                                                type="color"
                                                                value={track.color}
                                                                onChange={(e) => updateAutomationTrack(track.id, { color: e.target.value })}
                                                                className="h-7 w-full bg-[#101218] border border-white/10 rounded"
                                                                title="Couleur"
                                                            />
                                                        </div>
                                                        <p className="text-[9px] text-slate-500">
                                                            {track.keyframes.length} keyframes - double-clic sur la lane pour en ajouter, drag vertical pour la valeur, Shift+drag pour garder le temps.
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
