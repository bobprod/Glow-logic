"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, FolderOpen, Trash2, Clock, CheckCircle2, AlertTriangle, Download, Upload, PackageCheck, Sparkles } from 'lucide-react';
import useStore from '../../store/useStore';
import { API_BASE } from '../../lib/config';

interface ProjectModalProps {
    onClose: () => void;
}

const SHOW_SNAPSHOT_KEY = 'glow-logic-show-snapshots';
const PROJECT_PACK_KIND = 'glow-logic-project';
const LEGACY_PACK_KIND = 'glow-logic-show-pack';
const PROJECT_FILE_FORMAT = 'glowproject';
const SHOW_FILE_FORMAT = 'glowshow';
const LEGACY_FILE_FORMAT = 'glowpack';
const PROJECT_SCHEMA_VERSION = 3;
const PROJECT_FILE_EXTENSION = '.glowproject';
const ACCEPTED_PROJECT_FORMATS = new Set([PROJECT_FILE_FORMAT, SHOW_FILE_FORMAT, LEGACY_FILE_FORMAT]);

type PackStats = {
    fixtureGroups: number | null;
    venueProfiles: number | null;
    libraryItems: number | null;
};

type ProjectStorageHealth = {
    ok: boolean;
    schemaVersion: number;
    projectCount: number;
    invalidJsonCount: number;
    duplicateNameCount: number;
    latestUpdatedAt: string | null;
    issues: string[];
};

type ProjectStorageRepairReport = {
    ok: boolean;
    dryRun: boolean;
    scanned: number;
    normalized: number;
    invalidJson: number;
    duplicateNameCount: number;
    actions: string[];
    warnings: string[];
    health: ProjectStorageHealth;
};

type PendingImportPack = {
    fileName: string;
    pack: any;
    migrations: string[];
    unsupportedFuture: boolean;
};

function countKeys(value: unknown) {
    return value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length : 0;
}

function sanitizeProjectFileName(name: string) {
    return String(name || 'Glow Logic Show')
        .trim()
        .replace(/[^a-z0-9-_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'Glow_Logic_Show';
}

function getPackFormat(pack: any) {
    const rawFormat = String(pack?.manifest?.format || '').toLowerCase();
    if (ACCEPTED_PROJECT_FORMATS.has(rawFormat)) return rawFormat;
    return pack?.kind === LEGACY_PACK_KIND ? LEGACY_FILE_FORMAT : PROJECT_FILE_FORMAT;
}

function readLocalSnapshots() {
    try {
        return JSON.parse(localStorage.getItem(SHOW_SNAPSHOT_KEY) || '[]');
    } catch {
        return [];
    }
}

function buildPackReadiness(state: any, stats: PackStats, snapshots: any[]) {
    const playlist = Array.isArray(state.playlist) ? state.playlist : [];
    const mediaTracks = playlist.filter((track: any) => track.fileUrl || track.src || track.path);
    return [
        {
            label: 'Projet nomme',
            ok: Boolean(state.currentProjectName),
            required: false,
            detail: state.currentProjectName || 'Le pack aura un nom Glow Logic Show.',
        },
        {
            label: 'Patch fixtures',
            ok: Array.isArray(state.fixtures) && state.fixtures.length > 0,
            required: true,
            detail: `${Array.isArray(state.fixtures) ? state.fixtures.length : 0} fixture(s) chargee(s) dans l'interface.`,
        },
        {
            label: 'Groupes live',
            ok: stats.fixtureGroups !== null && stats.fixtureGroups > 0,
            required: true,
            detail: stats.fixtureGroups === null ? 'Verification en cours.' : `${stats.fixtureGroups} groupe(s) exporte(s).`,
        },
        {
            label: 'Scenes / pads',
            ok: Array.isArray(state.smartPads) && state.smartPads.length > 0,
            required: true,
            detail: `${Array.isArray(state.smartPads) ? state.smartPads.length : 0} pad(s) dans le show.`,
        },
        {
            label: 'Timeline',
            ok: Array.isArray(state.clips) && state.clips.length > 0,
            required: false,
            detail: `${Array.isArray(state.clips) ? state.clips.length : 0} clip(s), ${Array.isArray(state.markers) ? state.markers.length : 0} marker(s).`,
        },
        {
            label: 'Bibliotheque locale',
            ok: stats.libraryItems !== null && stats.libraryItems > 0,
            required: false,
            detail: stats.libraryItems === null ? 'Verification en cours.' : `${stats.libraryItems} item(s) non-systeme exportable(s).`,
        },
        {
            label: 'Profils de lieux',
            ok: stats.venueProfiles !== null && stats.venueProfiles > 0,
            required: false,
            detail: stats.venueProfiles === null ? 'Verification en cours.' : `${stats.venueProfiles} profil(s) exporte(s).`,
        },
        {
            label: 'Snapshots',
            ok: Array.isArray(snapshots) && snapshots.length > 0,
            required: false,
            detail: `${Array.isArray(snapshots) ? snapshots.length : 0} snapshot(s) rollback.`,
        },
        {
            label: 'Controle MIDI',
            ok: countKeys(state.midiMappings) > 0,
            required: false,
            detail: `${countKeys(state.midiMappings)} mapping(s) MIDI.`,
        },
        {
            label: 'Medias externes',
            ok: mediaTracks.length === 0,
            required: false,
            warning: mediaTracks.length > 0,
            detail: mediaTracks.length > 0 ? `${mediaTracks.length} piste(s) audio/video a recoller sur l'autre PC.` : 'Aucun fichier media local detecte.',
        },
    ];
}

function getImportCounts(pack: any) {
    const counts = pack?.manifest?.counts || {};
    const state = pack?.projectState || {};
    return {
        fixtures: counts.fixtures ?? (Array.isArray(state.fixtures) ? state.fixtures.length : 0),
        fixtureGroups: counts.fixtureGroups ?? (Array.isArray(pack.fixtureGroups) ? pack.fixtureGroups.length : 0),
        pads: counts.pads ?? (Array.isArray(state.smartPads) ? state.smartPads.length : 0),
        clips: counts.clips ?? (Array.isArray(state.clips) ? state.clips.length : 0),
        markers: counts.markers ?? (Array.isArray(state.markers) ? state.markers.length : 0),
        playlist: counts.playlist ?? (Array.isArray(state.playlist) ? state.playlist.length : 0),
        midiMappings: counts.midiMappings ?? countKeys(state.midiMappings),
        venueProfiles: counts.venueProfiles ?? (Array.isArray(pack.venueProfiles) ? pack.venueProfiles.length : 0),
        libraryItems: counts.libraryItems ?? (Array.isArray(pack.libraryItems) ? pack.libraryItems.length : 0),
        snapshots: counts.snapshots ?? (Array.isArray(pack.snapshots) ? pack.snapshots.length : 0),
    };
}

function getImportChecks(pack: any) {
    const readiness = pack?.manifest?.readiness;
    if (Array.isArray(readiness)) return readiness.slice(0, 8);
    return [
        { label: 'Projet', ok: Boolean(pack?.projectState), required: true, detail: 'Etat principal du show.' },
        { label: 'Groupes live', ok: Array.isArray(pack?.fixtureGroups) && pack.fixtureGroups.length > 0, required: true, detail: `${Array.isArray(pack?.fixtureGroups) ? pack.fixtureGroups.length : 0} groupe(s).` },
        { label: 'Scenes / pads', ok: Array.isArray(pack?.projectState?.smartPads) && pack.projectState.smartPads.length > 0, required: true, detail: `${Array.isArray(pack?.projectState?.smartPads) ? pack.projectState.smartPads.length : 0} pad(s).` },
        { label: 'Snapshots', ok: Array.isArray(pack?.snapshots) && pack.snapshots.length > 0, required: false, detail: `${Array.isArray(pack?.snapshots) ? pack.snapshots.length : 0} snapshot(s).` },
    ];
}

function normalizeImportedPack(rawPack: any) {
    const format = getPackFormat(rawPack);
    const validKind = rawPack?.kind === PROJECT_PACK_KIND || rawPack?.kind === LEGACY_PACK_KIND;
    if (!validKind || !rawPack?.projectState || !ACCEPTED_PROJECT_FORMATS.has(format)) {
        throw new Error('invalid_pack');
    }

    const sourceVersion = Number(rawPack.version || rawPack.manifest?.schemaVersion || 1);
    const migrations: string[] = [];
    const projectState = {
        nodes: [],
        edges: [],
        smartPads: [],
        smartZoneValues: {},
        smartZoneMappings: {},
        midiMappings: {},
        dmxOutputs: { qlcOsc: true, qlcWs: false, artNet: true, usbDmx: false },
        networkState: { adapters: [], activeAdapter: null, discoveredNodes: [] },
        appMode: 'smart',
        proView: 'canvas',
        clips: [],
        markers: [],
        duration: 60,
        zoom: 1,
        viewStart: 0,
        playlist: [],
        masterVolume: 80,
        masterDimmer: 255,
        blackout: false,
        smartBlackout: false,
        groupLevels: {},
        groupMutes: {},
        groupColors: {},
        showLock: false,
        laserArmed: false,
        pyroArmed: false,
        currentProjectName: rawPack.name || 'Imported Glow Logic Show',
        ...rawPack.projectState,
    };

    if (sourceVersion < 2) {
        migrations.push('Pack v1 normalise vers schema v2: manifest, valeurs par defaut et bibliotheque exportable.');
    }

    if (rawPack.kind === LEGACY_PACK_KIND || format === LEGACY_FILE_FORMAT) {
        migrations.push('Ancien .glowpack accepte et migre vers le format projet .glowproject.');
    }

    if (!Array.isArray(projectState.playlist)) {
        projectState.playlist = [];
        migrations.push('Playlist absente remplacee par une liste vide.');
    }
    projectState.playlist = projectState.playlist.map((track: any) => ({ ...track, fileUrl: track?.fileUrl || '' }));

    const normalizedPack = {
        ...rawPack,
        kind: PROJECT_PACK_KIND,
        version: Math.max(sourceVersion, PROJECT_SCHEMA_VERSION),
        projectState,
        fixtureGroups: Array.isArray(rawPack.fixtureGroups) ? rawPack.fixtureGroups : [],
        venueProfiles: Array.isArray(rawPack.venueProfiles) ? rawPack.venueProfiles : [],
        libraryItems: Array.isArray(rawPack.libraryItems) ? rawPack.libraryItems : [],
        snapshots: Array.isArray(rawPack.snapshots) ? rawPack.snapshots : [],
        manifest: {
            app: 'Glow Logic',
            ...(rawPack.manifest || {}),
            format: format === LEGACY_FILE_FORMAT ? PROJECT_FILE_FORMAT : format,
            schemaVersion: Math.max(sourceVersion, PROJECT_SCHEMA_VERSION),
            counts: getImportCounts({ ...rawPack, projectState }),
            readiness: getImportChecks({ ...rawPack, projectState }),
            notes: rawPack.manifest?.notes || ['Projet importe avec compatibilite Glow Logic.'],
        },
    };

    return {
        pack: normalizedPack,
        migrations,
        unsupportedFuture: sourceVersion > PROJECT_SCHEMA_VERSION,
    };
}

async function fetchJsonList(path: string) {
    try {
        const response = await fetch(`${API_BASE}${path}`);
        return response.ok ? await response.json() : [];
    } catch {
        return [];
    }
}

async function restoreFixtureGroups(groups: any[]) {
    if (!Array.isArray(groups)) return;
    await Promise.all(groups.map((group) => fetch(`${API_BASE}/api/fixture-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: group.name,
            role: group.role ?? null,
            color: group.color ?? '#06b6d4',
            fixtureIds: Array.isArray(group.fixtureIds) ? group.fixtureIds : [],
        }),
    })));
}

async function restoreVenueProfiles(venues: any[]) {
    if (!Array.isArray(venues)) return;
    await Promise.all(venues.map((venue) => fetch(`${API_BASE}/api/venue-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: venue.name,
            data: venue.data || {},
        }),
    })));
}

async function restoreLibraryItems(items: any[]) {
    if (!Array.isArray(items)) return;
    await fetch(`${API_BASE}/api/library/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ onClose }) => {
    const {
        availableProjects,
        fetchProjects,
        saveProject,
        loadProject,
        deleteProject,
        currentProjectName,
        showSnapshots,
        refreshShowSnapshots,
        createShowSnapshot,
        restoreShowSnapshot,
        deleteShowSnapshot,
        addToast,
    } = useStore();

    const [mounted, setMounted] = useState(false);
    const [projectName, setProjectName] = useState(currentProjectName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [packStats, setPackStats] = useState<PackStats>({
        fixtureGroups: null,
        venueProfiles: null,
        libraryItems: null,
    });
    const [storageHealth, setStorageHealth] = useState<ProjectStorageHealth | null>(null);
    const [storageAiAnalysis, setStorageAiAnalysis] = useState("");
    const [isAnalyzingStorage, setIsAnalyzingStorage] = useState(false);
    const [storageRepairReport, setStorageRepairReport] = useState<ProjectStorageRepairReport | null>(null);
    const [isRepairingStorage, setIsRepairingStorage] = useState(false);
    const [pendingImport, setPendingImport] = useState<PendingImportPack | null>(null);
    const [isImportingPack, setIsImportingPack] = useState(false);

    const refreshPackStats = async () => {
        const [fixtureGroups, venueProfiles, libraryRawItems] = await Promise.all([
            fetchJsonList('/api/fixture-groups'),
            fetchJsonList('/api/venue-profiles'),
            fetchJsonList('/api/library'),
        ]);
        const libraryItems = Array.isArray(libraryRawItems)
            ? libraryRawItems.filter((item: any) => item.scope !== 'system')
            : [];

        setPackStats({
            fixtureGroups: Array.isArray(fixtureGroups) ? fixtureGroups.length : 0,
            venueProfiles: Array.isArray(venueProfiles) ? venueProfiles.length : 0,
            libraryItems: libraryItems.length,
        });

        return { fixtureGroups, venueProfiles, libraryItems };
    };

    const refreshStorageHealth = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/projects/health`);
            if (response.ok) setStorageHealth(await response.json());
        } catch {
            setStorageHealth(null);
        }
    };

    const analyzeStorageWithAi = async () => {
        setIsAnalyzingStorage(true);
        setStorageAiAnalysis("");
        try {
            const response = await fetch(`${API_BASE}/api/projects/health/ai`, { method: 'POST' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error || 'Analyse IA indisponible');
            setStorageAiAnalysis(data.analysis || 'Aucune analyse generee.');
            if (data.health) setStorageHealth(data.health);
        } catch (error: any) {
            setStorageAiAnalysis(`Analyse IA indisponible: ${error.message || 'Verifier la cle BYOK dans Settings > LLM.'}`);
        } finally {
            setIsAnalyzingStorage(false);
        }
    };

    const repairStorage = async (dryRun: boolean) => {
        if (!dryRun && !storageRepairReport) return;
        if (!dryRun && !confirm('Appliquer la reparation non destructive du stockage projets ?')) return;
        setIsRepairingStorage(true);
        try {
            const response = await fetch(`${API_BASE}/api/projects/repair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error || 'Reparation indisponible');
            setStorageRepairReport(data);
            if (data.health) setStorageHealth(data.health);
            if (!dryRun) {
                addToast?.({
                    type: 'success',
                    message: 'Stockage projets repare',
                    detail: `${data.normalized} projet(s) normalise(s)`,
                });
                await fetchProjects();
            }
        } catch (error: any) {
            addToast?.({
                type: 'error',
                message: 'Reparation projets impossible',
                detail: error.message,
            });
        } finally {
            setIsRepairingStorage(false);
        }
    };

    useEffect(() => {
        fetchProjects();
        refreshShowSnapshots();
        refreshPackStats();
        refreshStorageHealth();
        setMounted(true);
    }, [fetchProjects, refreshShowSnapshots]);

    const handleSave = async () => {
        if (!projectName.trim()) return;
        setIsSaving(true);
        await saveProject(projectName);
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => {
            setSaveSuccess(false);
            onClose(); // Ferme automatiquement après la sauvegarde pour revenir au dashboard
        }, 1200);
    };

    const handleLoad = async (id: number) => {
        await loadProject(id);
        onClose();
    };

    const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
        e.stopPropagation();
        if (!confirm(`Supprimer le projet "${name}" ? Cette action est irréversible.`)) return;
        await deleteProject(id);
    };

    const handleCreateSnapshot = () => {
        createShowSnapshot(projectName.trim() ? `Avant changement · ${projectName.trim()}` : 'Snapshot manuel');
    };

    const handleRestoreSnapshot = (id: string, label: string) => {
        if (!confirm(`Restaurer le snapshot "${label}" ? L'état actuel sera remplacé.`)) return;
        restoreShowSnapshot(id);
        onClose();
    };

    const handleDeleteSnapshot = (e: React.MouseEvent, id: string, label: string) => {
        e.stopPropagation();
        if (!confirm(`Supprimer le snapshot "${label}" ?`)) return;
        deleteShowSnapshot(id);
    };

    const handleExportPack = async () => {
        const state = useStore.getState();
        const { fixtureGroups, venueProfiles, libraryItems } = await refreshPackStats();
        const snapshots = readLocalSnapshots();
        const readiness = buildPackReadiness(state, {
            fixtureGroups: Array.isArray(fixtureGroups) ? fixtureGroups.length : 0,
            venueProfiles: Array.isArray(venueProfiles) ? venueProfiles.length : 0,
            libraryItems: Array.isArray(libraryItems) ? libraryItems.length : 0,
        }, snapshots);
        const blocking = readiness.filter((item) => item.required && !item.ok);
        if (blocking.length > 0 && !confirm(`Le pack a ${blocking.length} point(s) critique(s) a verifier. Exporter quand meme ?`)) return;
        const exportedAt = new Date().toISOString();

        const pack = {
            kind: PROJECT_PACK_KIND,
            version: PROJECT_SCHEMA_VERSION,
            exportedAt,
            name: projectName.trim() || currentProjectName || 'Glow Logic Show',
            manifest: {
                app: 'Glow Logic',
                format: PROJECT_FILE_FORMAT,
                schemaVersion: PROJECT_SCHEMA_VERSION,
                kind: 'project',
                exportedAt,
                readiness: readiness.map(({ label, ok, required, warning, detail }) => ({
                    label,
                    ok,
                    required,
                    warning: Boolean(warning),
                    detail,
                })),
                counts: {
                    fixtures: Array.isArray(state.fixtures) ? state.fixtures.length : 0,
                    fixtureGroups: Array.isArray(fixtureGroups) ? fixtureGroups.length : 0,
                    pads: Array.isArray(state.smartPads) ? state.smartPads.length : 0,
                    clips: Array.isArray(state.clips) ? state.clips.length : 0,
                    markers: Array.isArray(state.markers) ? state.markers.length : 0,
                    playlist: Array.isArray(state.playlist) ? state.playlist.length : 0,
                    midiMappings: countKeys(state.midiMappings),
                    venueProfiles: Array.isArray(venueProfiles) ? venueProfiles.length : 0,
                    libraryItems: Array.isArray(libraryItems) ? libraryItems.length : 0,
                    snapshots: Array.isArray(snapshots) ? snapshots.length : 0,
                },
                notes: [
                    'Export final Glow Logic: etat du show, patch, timeline, bibliotheque locale, profils de lieux et snapshots.',
                    'Les fichiers audio/video locaux ne sont pas copies dans le .glowproject.',
                    'Verifier les ports DMX et les interfaces MIDI sur le nouvel ordinateur.',
                ],
            },
            projectState: {
                nodes: state.nodes,
                edges: state.edges,
                smartPads: state.smartPads,
                smartZoneValues: state.smartZoneValues,
                smartZoneMappings: state.smartZoneMappings,
                midiMappings: state.midiMappings,
                dmxOutputs: state.dmxOutputs,
                networkState: state.networkState,
                appMode: state.appMode,
                proView: state.proView,
                clips: state.clips,
                markers: state.markers,
                duration: state.duration,
                zoom: state.zoom,
                viewStart: state.viewStart,
                playlist: state.playlist?.map((track: any) => ({ ...track, fileUrl: '' })),
                masterVolume: state.masterVolume,
                masterDimmer: state.masterDimmer,
                blackout: state.blackout,
                smartBlackout: state.smartBlackout,
                groupLevels: state.groupLevels,
                groupMutes: state.groupMutes,
                groupColors: state.groupColors,
                showLock: state.showLock,
                laserArmed: state.laserArmed,
                pyroArmed: state.pyroArmed,
                currentProjectName: state.currentProjectName,
            },
            fixtureGroups,
            venueProfiles,
            libraryItems,
            snapshots,
        };

        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeProjectFileName(pack.name)}${PROJECT_FILE_EXTENSION}`;
        a.click();
        URL.revokeObjectURL(url);
        addToast?.({ type: 'success', message: 'Projet show exporte', detail: PROJECT_FILE_EXTENSION });
    };

    const handleImportPack = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        event.target.value = '';
        if (!selectedFile) return;
        const file = selectedFile;
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            try {
                const parsedPack = JSON.parse(String(loadEvent.target?.result || '{}'));
                const normalized = normalizeImportedPack(parsedPack);
                setPendingImport({ fileName: file.name, ...normalized });
            } catch (error: any) {
                addToast?.({
                    type: 'error',
                    message: 'Projet show invalide',
                    detail: error.message || 'Verifier le fichier .glowproject/.glowshow',
                });
            }
        };
        reader.readAsText(file);
    };

    const confirmImportPack = async () => {
        if (!pendingImport) return;
        const { pack, fileName } = pendingImport;
        setIsImportingPack(true);
        try {
            useStore.setState(pack.projectState);
            await restoreFixtureGroups(pack.fixtureGroups);
            await restoreVenueProfiles(pack.venueProfiles);
            await restoreLibraryItems(pack.libraryItems);
            if (Array.isArray(pack.snapshots)) {
                localStorage.setItem(SHOW_SNAPSHOT_KEY, JSON.stringify(pack.snapshots.slice(0, 12)));
                refreshShowSnapshots();
            }
            addToast?.({ type: 'success', message: 'Projet show importe', detail: pack.name || fileName });
            onClose();
        } catch (error: any) {
            addToast?.({
                type: 'error',
                message: 'Import projet impossible',
                detail: error.message || 'Verifier le fichier .glowproject/.glowshow',
            });
        } finally {
            setIsImportingPack(false);
        }
    };

    if (!mounted) return null;

    const packSnapshots = readLocalSnapshots();
    const packReadiness = buildPackReadiness(useStore.getState(), packStats, packSnapshots);
    const packCriticalMissing = packReadiness.filter((item) => item.required && !item.ok).length;
    const packWarnings = packReadiness.filter((item) => item.warning || (!item.required && !item.ok)).length;
    const pendingImportCounts = pendingImport ? getImportCounts(pendingImport.pack) : null;
    const pendingImportChecks = pendingImport ? getImportChecks(pendingImport.pack) : [];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-[#0f1218]/98 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-xl">
                            <Save className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white tracking-tight">Gestion des projets</h2>
                          <p className="text-xs text-slate-400">Sauvegardez et chargez vos configurations Glow Logic</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Save Current Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span>Sauvegarder le projet actuel</span>
                        </h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="Nom du projet..."
                                className="flex-1 bg-black/45 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600 font-medium"
                            />
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !projectName.trim()}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all cursor-pointer ${saveSuccess
                                    ? 'bg-green-500 text-white'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-black/30 border-t-black animate-spin rounded-full" />
                                ) : saveSuccess ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                {saveSuccess ? 'SAUVEGARDÉ' : 'SAUVEGARDER'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                            Pack show portable
                        </h3>
                        {storageHealth && (
                            <div className={`rounded-2xl border px-4 py-3 space-y-3 ${
                                storageHealth.ok
                                    ? 'border-emerald-400/15 bg-emerald-500/5'
                                    : 'border-amber-400/25 bg-amber-500/5'
                            }`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-white text-xs font-black uppercase tracking-widest">Stockage projets</p>
                                        <p className="text-[10px] text-slate-500 font-semibold mt-1">
                                            {storageHealth.projectCount} projet(s), schema v{storageHealth.schemaVersion}
                                            {storageHealth.latestUpdatedAt ? `, dernier update ${new Date(storageHealth.latestUpdatedAt).toLocaleString('fr-FR')}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={analyzeStorageWithAi}
                                            disabled={isAnalyzingStorage}
                                            className="px-3 py-1.5 rounded-xl border border-cyan-400/20 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Sparkles className={`w-3 h-3 ${isAnalyzingStorage ? 'animate-spin' : ''}`} />
                                            IA
                                        </button>
                                        <button
                                            onClick={() => repairStorage(true)}
                                            disabled={isRepairingStorage}
                                            className="px-3 py-1.5 rounded-xl border border-amber-400/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                        >
                                            {isRepairingStorage ? 'Check...' : 'Reparer'}
                                        </button>
                                        <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                                            storageHealth.ok
                                                ? 'border-emerald-400/20 text-emerald-300 bg-emerald-500/10'
                                                : 'border-amber-400/30 text-amber-300 bg-amber-500/10'
                                        }`}>
                                            {storageHealth.ok ? 'OK' : `${storageHealth.issues.length} souci(s)`}
                                        </div>
                                    </div>
                                </div>
                                {storageAiAnalysis && (
                                    <div className="rounded-xl border border-cyan-400/15 bg-black/30 px-3 py-2">
                                        <p className="text-[10px] text-cyan-200 font-black uppercase tracking-widest mb-1">Analyse IA BYOK</p>
                                        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">{storageAiAnalysis}</p>
                                    </div>
                                )}
                                {storageRepairReport && (
                                    <div className="rounded-xl border border-amber-400/15 bg-black/30 px-3 py-2 space-y-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] text-amber-200 font-black uppercase tracking-widest">
                                                    {storageRepairReport.dryRun ? 'Apercu reparation' : 'Reparation appliquee'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                                    {storageRepairReport.scanned} projet(s) scanne(s), {storageRepairReport.normalized} a normaliser, {storageRepairReport.invalidJson} JSON invalide(s).
                                                </p>
                                            </div>
                                            {storageRepairReport.dryRun && (
                                                <button
                                                    onClick={() => repairStorage(false)}
                                                    disabled={isRepairingStorage}
                                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                >
                                                    Appliquer
                                                </button>
                                            )}
                                        </div>
                                        {(storageRepairReport.actions.length > 0 || storageRepairReport.warnings.length > 0) && (
                                            <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                                {[...storageRepairReport.actions, ...storageRepairReport.warnings].slice(0, 6).map((line) => (
                                                    <p key={line} className="text-[10px] text-slate-500 leading-relaxed">{line}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/25 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <PackageCheck className="w-5 h-5 text-emerald-400" />
                                <div>
                                    <p className="text-white text-xs font-black uppercase tracking-widest">Checklist transport</p>
                                    <p className="text-[10px] text-slate-500 font-semibold">
                                        {packReadiness.filter((item) => item.ok).length}/{packReadiness.length} checks OK
                                        {packWarnings > 0 ? `, ${packWarnings} info(s)` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                                packCriticalMissing === 0
                                    ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
                                    : 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                            }`}>
                                {packCriticalMissing === 0 ? 'Pret export' : `${packCriticalMissing} critique(s)`}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {packReadiness.map((item) => (
                                <div
                                    key={item.label}
                                    className={`rounded-xl border px-3 py-2 bg-black/30 ${
                                        item.ok
                                            ? 'border-emerald-400/15'
                                            : item.required
                                                ? 'border-red-400/25'
                                                : 'border-amber-400/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] text-white font-black uppercase tracking-wider">{item.label}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                                            item.ok ? 'text-emerald-300' : item.required ? 'text-red-300' : 'text-amber-300'
                                        }`}>
                                            {item.ok ? 'OK' : item.required ? 'A faire' : 'Info'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <button
                                onClick={handleExportPack}
                                className="project-export-button flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-3 text-emerald-300 text-xs font-black uppercase tracking-widest transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Exporter .glowproject
                            </button>
                            <label className="project-import-button flex items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-3 text-violet-300 text-xs font-black uppercase tracking-widest transition-all cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Importer .glowproject
                                <input
                                    type="file"
                                    accept=".glowproject,.glowshow,.glowpack,application/json"
                                    onChange={handleImportPack}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        {pendingImport && pendingImportCounts && (
                            <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-4 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-white text-xs font-black uppercase tracking-widest">Apercu import projet show</p>
                                        <p className="text-[11px] text-slate-400 font-semibold mt-1">
                                            {pendingImport.pack.name || pendingImport.fileName} - {getPackFormat(pendingImport.pack)} v{pendingImport.pack.version || 1}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPendingImport(null)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                                        title="Annuler l'import"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {[
                                        ['Fixtures', pendingImportCounts.fixtures],
                                        ['Groupes', pendingImportCounts.fixtureGroups],
                                        ['Pads', pendingImportCounts.pads],
                                        ['Timeline', pendingImportCounts.clips + pendingImportCounts.markers],
                                        ['Snapshots', pendingImportCounts.snapshots],
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{label}</p>
                                            <p className="text-white text-lg font-black">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {pendingImportChecks.map((item: any) => (
                                        <div
                                            key={item.label}
                                            className={`rounded-xl border px-3 py-2 bg-black/30 ${
                                                item.ok ? 'border-emerald-400/15' : item.required ? 'border-red-400/25' : 'border-amber-400/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[10px] text-white font-black uppercase tracking-wider">{item.label}</span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${item.ok ? 'text-emerald-300' : item.required ? 'text-red-300' : 'text-amber-300'}`}>
                                                    {item.ok ? 'OK' : item.required ? 'A faire' : 'Info'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{item.detail}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-500/5 px-3 py-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-100/80 leading-relaxed font-semibold">
                                        Importer ce projet remplace l'etat actuel du show. Creez un snapshot avant si vous voulez pouvoir revenir en arriere.
                                    </p>
                                </div>

                                {(pendingImport.unsupportedFuture || pendingImport.migrations.length > 0) && (
                                    <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-3 py-2">
                                        <p className="text-[10px] text-cyan-200 font-black uppercase tracking-widest mb-1">
                                            Compatibilite projet
                                        </p>
                                        <div className="space-y-1">
                                            {pendingImport.unsupportedFuture && (
                                                <p className="text-[10px] text-amber-200 leading-relaxed font-semibold">
                                                    Ce projet vient d'une version plus recente. Glow Logic va tenter l'import avec les champs connus.
                                                </p>
                                            )}
                                            {pendingImport.migrations.length === 0 ? (
                                                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Aucune migration necessaire.</p>
                                            ) : (
                                                pendingImport.migrations.map((migration) => (
                                                    <p key={migration} className="text-[10px] text-slate-400 leading-relaxed font-semibold">{migration}</p>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPendingImport(null)}
                                        className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-black transition-all"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={confirmImportPack}
                                        disabled={isImportingPack}
                                        className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-xs font-black transition-all disabled:opacity-50"
                                    >
                                        {isImportingPack ? 'Import...' : 'Importer et remplacer'}
                                    </button>
                                </div>
                            </div>
                        )}
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Inclut l'etat du show, groupes de fixtures, lieux personnalises, bibliotheque exportable et snapshots locaux. Les fichiers audio/video ne sont pas copies.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                Snapshots / rollback
                            </h3>
                            <button
                                onClick={handleCreateSnapshot}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold transition-all"
                            >
                                <Clock className="w-4 h-4" />
                                Snapshot maintenant
                            </button>
                        </div>

                        <div className="grid gap-3">
                            {showSnapshots.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                                    <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Aucun snapshot local</p>
                                </div>
                            ) : (
                                showSnapshots.map((snapshot) => (
                                    <div
                                        key={snapshot.id}
                                        className="group bg-amber-500/[0.03] hover:bg-amber-500/[0.06] border border-amber-400/10 hover:border-amber-400/25 rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer"
                                        onClick={() => handleRestoreSnapshot(snapshot.id, snapshot.label)}
                                    >
                                        <div>
                                            <h4 className="text-white font-bold group-hover:text-amber-200 transition-colors">{snapshot.label}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 font-mono">
                                                <Clock className="w-3.5 h-3.5 text-slate-600" />
                                                <span>{new Date(snapshot.createdAt).toLocaleString('fr-FR')}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="px-3.5 py-1.5 bg-amber-500/10 text-amber-300 text-[10px] font-black rounded-xl uppercase tracking-widest border border-amber-400/20">
                                                Restaurer
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSnapshot(e, snapshot.id, snapshot.label)}
                                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="Supprimer ce snapshot"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Load Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                            Projets Disponibles
                        </h3>

                        <div className="grid gap-3">
                            {availableProjects.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                                    <FolderOpen className="w-12 h-12 text-slate-700 mx-auto mb-3 animate-pulse" />
                                    <p className="text-slate-500 text-sm">Aucun projet sauvegardé trouvé</p>
                                </div>
                            ) : (
                                availableProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer"
                                        onClick={() => handleLoad(project.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform border border-indigo-500/10">
                                                <FolderOpen className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold group-hover:text-cyan-300 transition-colors">{project.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 font-mono">
                                                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                                                    <span>Dernière modif : {new Date(project.updated_at).toLocaleString('fr-FR')}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="px-3.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-black rounded-xl uppercase tracking-widest border border-cyan-500/20 group-hover:border-cyan-500/40 transition-all">
                                                Charger
                                            </div>
                                            <button
                                                onClick={(e) => handleDelete(e, project.id, project.name)}
                                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="Supprimer ce projet"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Tips */}
                <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between px-6">
                    <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold font-mono">
                        Base SQLite (Serveur Local)
                    </p>
                    <button
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <span>Retour au Dashboard</span>
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
