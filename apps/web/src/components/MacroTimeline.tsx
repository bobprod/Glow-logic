"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Terminal, Trash2, X, ZoomIn, ZoomOut, Flag, Plus, SlidersHorizontal } from 'lucide-react';
import { socket } from '../lib/socket';
import { dmxEngine } from '../lib/dmxEngine';
import useStore from '../store/useStore';
import { AutomationChannelType, AutomationTrack, TimelineClip } from '../store/slices/timelineSlice';
import SceneClipPanel from './timeline/SceneClipPanel';
import CueClipPanel from './timeline/CueClipPanel';
import ChaserTrackPanel from './timeline/ChaserTrackPanel';

// ─── Types ────────────────────────────────────────────────────
type LogEntry = { id: number; type: 'sys' | 'ai' | 'warn' | 'osc' | 'info'; text: string };

const INIT_LOGS: LogEntry[] = [
    { id: 1, type: 'sys',  text: '[SYS] Art-Net Broadcast OK (Uni 1)' },
    { id: 2, type: 'ai',   text: '[AI] Drop in 4 beats. Queuing Scene "MAIN DROP STROBE".' },
    { id: 3, type: 'warn', text: '[WARN] Fixture "Moving Head 2" missed RDM ping.' },
    { id: 4, type: 'osc',  text: '[OSC] /qlc/button/1/2 1.0 → 127.0.0.1:7700' },
];

const LOG_COLOR: Record<LogEntry['type'], string> = {
    sys: 'text-green-400', ai: 'text-cyan-400', warn: 'text-yellow-400',
    osc: 'text-slate-400', info: 'text-blue-400',
};

const TRACKS = ['lights', 'visuals', 'fx'] as const;
const TRACK_LABELS: Record<string, string> = { lights: 'LIGHTS', visuals: 'VISUALS', fx: 'FX (LASER)' };

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

// ─── Helpers ─────────────────────────────────────────────────
function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const sec = (totalSec % 60).toString().padStart(2, '0');
    const msFmt = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${min}:${sec}.${msFmt}`;
}

function clampDmx(value: number) {
    return Math.max(0, Math.min(255, Math.round(value)));
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
            return clampDmx(a.value + (b.value - a.value) * t);
        }
    }

    return clampDmx(last.value);
}

// ─── New Clip Modal ───────────────────────────────────────────
function NewClipModal({ track, startTime, onConfirm, onCancel }: {
    track: string; startTime: number;
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

// ─── Main Component ───────────────────────────────────────────
export default function MacroTimeline() {
    const {
        isTimelineVisible,
        clips, duration, zoom,
        addClip, updateClip, deleteClip,
        markers, addMarker, deleteMarker,
        automationTracks,
        addAutomationTrack,
        updateAutomationTrack,
        deleteAutomationTrack,
        addAutomationKeyframe,
        updateAutomationKeyframe,
        deleteAutomationKeyframe,
        setDuration, setZoom,
        smartPads,
        addToast,
    } = useStore();

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [elapsed, setElapsed] = useState(0);

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

    // Drag / Resize
    const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
    const [dragOffsetMs, setDragOffsetMs] = useState(0);
    const [resizingClipId, setResizingClipId] = useState<string | null>(null);

    // Ruler interaction
    const [rulerDragMode, setRulerDragMode] = useState<'playhead' | 'loop' | null>(null);
    const [loopAnchorMs, setLoopAnchorMs] = useState(0);

    // Modals
    const [newClipPending, setNewClipPending] = useState<{ track: string; startTime: number } | null>(null);
    const [newMarkerPending, setNewMarkerPending] = useState<number | null>(null);
    const [arrangementTab, setArrangementTab] = useState<'inspector' | 'scenes' | 'cues' | 'chasers' | 'automations'>('inspector');

    // Refs
    const tracksBodyRef = useRef<HTMLDivElement>(null); // zone tracks (sans labels)
    const rulerRef = useRef<HTMLDivElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logCountRef = useRef(100);
    const [logs, setLogs] = useState<LogEntry[]>(INIT_LOGS);

    // Zoom window: viewDuration = how many ms are visible
    const viewDuration = duration / zoom;
    const [viewStart, setViewStart] = useState(0);
    const viewEnd = Math.min(viewStart + viewDuration, duration);

    // Convert ms ↔ % within visible window
    const msToPct = (ms: number) => ((ms - viewStart) / viewDuration) * 100;
    const pxToMs = useCallback((px: number, containerWidth: number) =>
        viewStart + (px / containerWidth) * viewDuration,
        [viewStart, viewDuration]);
    const selectedAutomationTrack = automationTracks.find(track => track.id === selectedAutomationTrackId)
        ?? (selectedKeyframe ? automationTracks.find(track => track.id === selectedKeyframe.trackId) : null)
        ?? automationTracks[0]
        ?? null;
    const selectedAutomationKeyframe = selectedKeyframe
        ? automationTracks.find(track => track.id === selectedKeyframe.trackId)?.keyframes.find(keyframe => keyframe.id === selectedKeyframe.keyframeId) ?? null
        : null;

    // ── Timer ──────────────────────────────────────────────────
    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => {
                    const next = prev + 50;
                    if (isLoopEnabled && loopStart !== null && loopEnd !== null && next >= loopEnd) return loopStart;
                    return next > duration ? duration : next;
                });
            }, 50);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isPlaying, duration, isLoopEnabled, loopStart, loopEnd]);

    // Auto-scroll playhead into view
    useEffect(() => {
        if (elapsed < viewStart || elapsed > viewEnd) {
            setViewStart(Math.max(0, Math.min(elapsed, duration - viewDuration)));
        }
    }, [duration, elapsed, viewDuration, viewEnd, viewStart]);

    // ── AI Inspector ───────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const addLog = (type: LogEntry['type'], text: string) => {
            logCountRef.current += 1;
            setLogs(prev => [...prev.slice(-49), { id: logCountRef.current, type, text }]);
        };
        socket.on('connect', () => addLog('sys', '[SYS] Socket.IO connecté.'));
        socket.on('disconnect', () => addLog('warn', '[WARN] Déconnecté du backend.'));
        socket.on('timeline_log', (data: { type: LogEntry['type']; text: string }) => {
            addLog(data.type || 'info', data.text);
        });
        return () => {
            socket?.off('connect');
            socket?.off('disconnect');
            socket?.off('timeline_log');
        };
    }, []);

    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

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
            clip.dmxCommands.forEach((command) => {
                dmxEngine.setChannel(command.universe, command.channel, command.value, { source: 'timeline' });
            });
            socket.emit('timeline_log', {
                type: 'sys',
                text: `[Timeline] Clip DMX "${clip.name}" (${clip.dmxCommands.length} canaux)`,
            });
        });

        activeWidgetsRef.current = newActiveKeys;
        activeDmxClipsRef.current = newActiveDmxClipIds;
    }, [elapsed, clips, isPlaying, automationTracks]);

    // ── Multi-select keyboard shortcuts ────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
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
    }, [selectedClipIds, clipboard, clips, deleteClip, addClip, elapsed]);

    // ── Playback helpers ───────────────────────────────────────
    const handlePlayPause = useCallback(() => setIsPlaying(p => !p), []);
    const handleSkipBack = useCallback(() => { setElapsed(0); setIsPlaying(false); }, []);
    const handleSkipForward = useCallback(() => setElapsed(p => Math.min(p + 10000, duration)), [duration]);

    // ── Zoom (scroll wheel) ────────────────────────────────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 0.85;
        const newZoom = Math.max(1, Math.min(20, zoom * factor));
        setZoom(newZoom);
    }, [zoom, setZoom]);

    // ── Ruler: click = playhead, right-click = marker, alt+drag = loop ──
    const getRulerMs = (e: React.MouseEvent) => {
        if (!rulerRef.current) return 0;
        const rect = rulerRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration));
    };

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (e.button === 2) {
            // Right-click → new marker
            setNewMarkerPending(getRulerMs(e));
            return;
        }
        const ms = getRulerMs(e);
        if (e.altKey) {
            // Alt+drag → loop region
            setRulerDragMode('loop');
            setLoopAnchorMs(ms);
            setLoopStart(ms);
            setLoopEnd(ms);
        } else {
            // Normal click → set playhead
            setElapsed(ms);
            setRulerDragMode('playhead');
        }
    };

    const handleRulerMouseMove = useCallback((e: MouseEvent) => {
        if (!rulerDragMode || !rulerRef.current) return;
        const rect = rulerRef.current.getBoundingClientRect();
        const ms = Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration));
        if (rulerDragMode === 'playhead') setElapsed(ms);
        if (rulerDragMode === 'loop') {
            setLoopStart(Math.min(ms, loopAnchorMs));
            setLoopEnd(Math.max(ms, loopAnchorMs));
        }
    }, [rulerDragMode, pxToMs, duration, loopAnchorMs]);

    const handleRulerMouseUp = useCallback(() => { setRulerDragMode(null); }, []);

    useEffect(() => {
        if (rulerDragMode) {
            window.addEventListener('mousemove', handleRulerMouseMove);
            window.addEventListener('mouseup', handleRulerMouseUp);
            return () => { window.removeEventListener('mousemove', handleRulerMouseMove); window.removeEventListener('mouseup', handleRulerMouseUp); };
        }
    }, [rulerDragMode, handleRulerMouseMove, handleRulerMouseUp]);

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

    const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
        e.preventDefault();
        if (!draggedClipId || !tracksBodyRef.current) return;
        const clip = clips.find(c => c.id === draggedClipId);
        if (!clip) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const dropMs = pxToMs(e.clientX - rect.left, rect.width);
        const primaryNewStart = Math.max(0, Math.min(dropMs - dragOffsetMs, duration - clip.duration));
        const deltaMs = primaryNewStart - clip.startTime;

        if (selectedClipIds.includes(draggedClipId) && selectedClipIds.length > 1) {
            // Move all selected clips by the same delta
            selectedClipIds.forEach(sid => {
                const sc = clips.find(x => x.id === sid);
                if (sc) {
                    const ns = Math.max(0, Math.min(sc.startTime + deltaMs, duration - sc.duration));
                    updateClip(sid, { startTime: ns, track: sid === draggedClipId ? trackId as any : sc.track });
                }
            });
        } else {
            updateClip(draggedClipId, { startTime: primaryNewStart, track: trackId as any });
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
        if (clip && ms > clip.startTime + 1000) updateClip(resizingClipId, { duration: ms - clip.startTime });
    }, [resizingClipId, clips, duration, pxToMs, updateClip]);

    const handleResizeUp = () => setResizingClipId(null);

    useEffect(() => {
        if (resizingClipId) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeUp);
            return () => { window.removeEventListener('mousemove', handleResizeMove); window.removeEventListener('mouseup', handleResizeUp); };
        }
    }, [resizingClipId, handleResizeMove]);

    // ── Double-click track → new clip ─────────────────────────
    const handleTrackDoubleClick = (e: React.MouseEvent, track: string) => {
        if (!tracksBodyRef.current) return;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const ms = Math.max(0, Math.min(pxToMs(e.clientX - rect.left, rect.width), duration - 10000));
        setNewClipPending({ track, startTime: ms });
    };

    const confirmNewClip = (name: string, color: string, textColor: string) => {
        if (!newClipPending) return;
        addClip({
            id: `clip-${Date.now()}`,
            track: newClipPending.track as any,
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

    const getAutomationMsFromClientX = useCallback((clientX: number) => {
        if (!tracksBodyRef.current) return elapsed;
        const rect = tracksBodyRef.current.getBoundingClientRect();
        const timeAreaWidth = Math.max(1, rect.width - TRACK_LABEL_WIDTH_PX);
        const x = Math.max(0, Math.min(clientX - rect.left - TRACK_LABEL_WIDTH_PX, timeAreaWidth));
        const ms = viewStart + (x / timeAreaWidth) * viewDuration;
        return Math.round(Math.max(0, Math.min(ms, duration)) / 100) * 100;
    }, [duration, elapsed, viewDuration, viewStart]);

    const addKeyframeToTrack = useCallback((track: AutomationTrack, timeMs: number) => {
        const value = getAutomationValueAtTime(track, timeMs) ?? dmxEngine.getChannel(track.universe, track.channel);
        const keyframe = {
            id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timeMs,
            value,
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
        const timeMs = Math.round((viewStart + (x / Math.max(1, rect.width)) * viewDuration) / 100) * 100;
        addKeyframeToTrack(track, Math.max(0, Math.min(timeMs, duration)));
    };

    const handleKeyframeMouseDown = (e: React.MouseEvent, trackId: string, keyframeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedAutomationTrackId(trackId);
        setSelectedKeyframe({ trackId, keyframeId });
        setDraggingKeyframe({ trackId, keyframeId });
    };

    useEffect(() => {
        if (!draggingKeyframe) return;
        const handleMove = (e: MouseEvent) => {
            updateAutomationKeyframe(draggingKeyframe.trackId, draggingKeyframe.keyframeId, {
                timeMs: getAutomationMsFromClientX(e.clientX),
            });
        };
        const handleUp = () => setDraggingKeyframe(null);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [draggingKeyframe, getAutomationMsFromClientX, updateAutomationKeyframe]);

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

            <div className="macro-timeline-container relative h-72 bg-[#12141A] border-t border-slate-800 z-40 flex shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 select-none">

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

                        {isPlaying && <span className="text-[10px] text-yellow-400 animate-pulse font-bold">● REC</span>}

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

                        <div className="flex-1" />

                        {/* Loop */}
                        <button
                            onClick={() => setIsLoopEnabled(p => !p)}
                            title={loopStart !== null ? 'Toggle loop' : 'Alt+drag ruler pour définir la zone'}
                            className={`text-[9px] font-bold px-2 py-1 rounded border transition-all ${isLoopEnabled && loopStart !== null
                                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                        >
                            LOOP {loopStart !== null ? `${formatTime(loopStart)}→${formatTime(loopEnd ?? 0)}` : ''}
                        </button>

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
                                return (
                                    <div
                                        key={m.id}
                                        className="absolute top-0 flex flex-col items-center group/marker z-10"
                                        style={{ left: `${pct}%` }}
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

                        {/* ── Tracks body ── */}
                        <div ref={tracksBodyRef} className="flex-1 relative flex flex-col overflow-hidden">
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
                                    className="flex-1 border-b border-[#262c36] flex overflow-hidden"
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
                                                    className={`absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 text-[8px] font-bold overflow-hidden cursor-grab active:cursor-grabbing group/clip select-none border ${clip.textColor} ${isSelected ? 'ring-1 ring-white/70 border-white/40' : 'border-white/10'}`}
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
                            {automationTracks.map(track => (
                                <div
                                    key={track.id}
                                    className={`timeline-automation-lane h-8 flex border-b border-[#262c36] overflow-hidden ${selectedAutomationTrack?.id === track.id ? 'bg-white/[0.035]' : ''}`}
                                    onClick={() => {
                                        setSelectedAutomationTrackId(track.id);
                                        setArrangementTab('automations');
                                    }}
                                >
                                    <span className="text-[8px] text-slate-500 font-bold uppercase w-14 flex-shrink-0 flex items-center justify-end pr-2 border-r border-[#262c36]">
                                        AUTO
                                    </span>
                                    <div
                                        className="flex-1 relative cursor-crosshair"
                                        onDoubleClick={(e) => handleAutomationRowDoubleClick(e, track)}
                                        title="Double-clic pour poser une keyframe"
                                    >
                                        <div
                                            className="absolute left-0 right-0 top-1/2 h-px opacity-50"
                                            style={{ background: track.color }}
                                        />
                                        <div className="absolute left-2 top-0.5 text-[8px] font-bold pointer-events-none" style={{ color: track.color }}>
                                            {track.label} {track.enabled ? '' : '(off)'}
                                        </div>
                                        {track.keyframes.map(keyframe => {
                                            const pct = msToPct(keyframe.timeMs);
                                            if (pct < -1 || pct > 101) return null;
                                            const selected = selectedKeyframe?.trackId === track.id && selectedKeyframe.keyframeId === keyframe.id;
                                            return (
                                                <button
                                                    key={keyframe.id}
                                                    onMouseDown={(e) => handleKeyframeMouseDown(e, track.id, keyframe.id)}
                                                    className={`absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-all ${selected ? 'border-white scale-125' : 'border-black/60 hover:scale-110'}`}
                                                    style={{ left: `${pct}%`, background: track.color }}
                                                    title={`${track.label} - ${formatTime(keyframe.timeMs)} - ${keyframe.value}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hints */}
                    <p className="text-[8px] text-slate-600 mt-1 flex-shrink-0">
                        Clic règle = playhead · Clic droit = marker · Alt+drag = loop · Double-clic piste = créer clip · Shift+clic = multi-select · Ctrl+C/V = copier · Suppr = effacer · Scroll = zoom
                    </p>
                </div>

                {/* ===== Arrangement Tools ===== */}
                <div className="w-[420px] flex flex-col p-2.5 bg-[#12141A]">
                    <div className="flex items-center gap-1 border-b border-[#262c36] pb-1.5 mb-2">
                        {[
                            { id: 'inspector', label: 'Inspecteur' },
                            { id: 'scenes', label: 'Scenes' },
                            { id: 'cues', label: 'Cues' },
                            { id: 'chasers', label: 'Chasers' },
                            { id: 'automations', label: 'Auto' },
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
                        {arrangementTab === 'inspector' && (
                            <button onClick={() => setLogs([])} className="text-slate-600 hover:text-red-400 transition-colors" title="Vider l'inspecteur">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {arrangementTab === 'inspector' && (
                            <div className="h-full flex flex-col">
                                <h3 className="text-slate-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5 mb-2">
                                    <Terminal className="w-3 h-3 text-cyan-500" />AI Inspector
                                </h3>
                                <div className="flex-1 font-mono text-[9px] overflow-y-auto space-y-0.5 pr-1">
                                    {logs.length === 0 && <p className="text-slate-600 italic">Console vide.</p>}
                                    {logs.map(log => (
                                        <p key={log.id} className={LOG_COLOR[log.type]}>{log.text}</p>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </div>
                        )}
                        {arrangementTab === 'scenes' && <SceneClipPanel />}
                        {arrangementTab === 'cues' && <CueClipPanel />}
                        {arrangementTab === 'chasers' && <ChaserTrackPanel />}
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
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    {automationTracks.length === 0 && (
                                        <p className="text-[10px] text-slate-500 border border-dashed border-white/10 rounded-lg p-3">
                                            Aucune automation. Creez une piste puis double-cliquez dans la lane AUTO pour poser des keyframes.
                                        </p>
                                    )}
                                    {automationTracks.map(track => (
                                        <div
                                            key={track.id}
                                            className={`border rounded-lg p-2 space-y-2 ${selectedAutomationTrack?.id === track.id ? 'border-emerald-500/35 bg-emerald-500/[0.04]' : 'border-white/10 bg-black/15'}`}
                                            onClick={() => setSelectedAutomationTrackId(track.id)}
                                        >
                                            <div className="flex items-center gap-2">
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
                                                    className="flex-1 bg-[#101218] border border-white/10 rounded px-2 py-1 text-[10px] text-white"
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addKeyframeToTrack(track, elapsed);
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
                                            <div className="flex flex-wrap gap-1">
                                                {track.keyframes.map(keyframe => (
                                                    <button
                                                        key={keyframe.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedAutomationTrackId(track.id);
                                                            setSelectedKeyframe({ trackId: track.id, keyframeId: keyframe.id });
                                                        }}
                                                        className={`px-1.5 py-0.5 rounded border text-[8px] font-mono ${selectedKeyframe?.trackId === track.id && selectedKeyframe.keyframeId === keyframe.id ? 'border-white text-white' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}
                                                    >
                                                        {formatTime(keyframe.timeMs)}:{keyframe.value}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
