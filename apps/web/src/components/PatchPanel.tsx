'use client';

import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/config';
import { socket } from '../lib/socket';
import { useRouter } from 'next/navigation';
import { Wand2, Plus, Grid3X3, ScanLine, CheckCircle2, AlertTriangle, X, Trash2, Zap, Move, Lightbulb } from 'lucide-react';
import FixturesPage from './FixturesPage';
import { dmxEngine } from '../lib/dmxEngine';
import FixtureProfileBuilder from './ui/FixtureProfileBuilder';

// ─── Palette of distinct fixture colors ───────────────────────────
const COLORS = [
  '#06b6d4', '#a855f7', '#ec4899', '#22c55e',
  '#f97316', '#eab308', '#3b82f6', '#ef4444',
  '#14b8a6', '#8b5cf6', '#f43f5e', '#84cc16',
  '#0ea5e9', '#d946ef', '#fb923c', '#4ade80',
];

// ─── Types ────────────────────────────────────────────────────────
interface PatchedFixture {
  nodeId: string;
  fixtureId?: number;
  name: string;
  universe: number;
  startAddress: number;
  totalChannels: number;
  color: string;
  nodeType: string;
}

interface LibraryFixture {
  id: number;
  name: string;
  manufacturer: string | null;
  total_channels: number;
  start_address: number;
}

interface FixtureGroup {
  id: number;
  name: string;
  role: string | null;
  color: string;
  fixtureIds: number[];
}

interface LicenseSnapshot {
  mode: 'trial' | 'activated' | 'expired' | 'invalid';
  offlineReady: boolean;
  trialDaysRemaining?: number;
}

interface SavedVenueProfile {
  id: number;
  name: string;
  data: {
    template?: FixtureTemplateId;
    count?: number;
    universe?: number;
    groupName?: string;
    namePrefix?: string;
    showProfile?: AssistantShowProfileId;
    controlSurface?: AssistantControlSurfaceId;
    createShow?: boolean;
  };
  updated_at: string;
}

type FixtureTemplateId = 'par_rgbw' | 'moving_head_spot' | 'bar_rgb' | 'strobe';
type AssistantDmxCommand = { universe: number; channel: number; value: number };
type AssistantShowProfileId = 'dj' | 'wedding' | 'conference' | 'theatre' | 'live_band' | 'vj';
type AssistantControlSurfaceId = 'touch' | 'apc_mini' | 'launchpad' | 'keyboard';
type AssistantVenueProfileId = 'small_bar' | 'wedding_hall' | 'club' | 'conference_room' | 'live_stage' | 'mapping_room';
type AssistantPadPreset = {
  name: string;
  color: string;
  textColor: string;
  iconName: string;
  rgb: { r: number; g: number; b: number; w?: number };
  options: { intensity?: number; strobe?: number; gobo?: number; prism?: number; center?: boolean };
};

const ASSISTANT_VENUE_PROFILES: Record<AssistantVenueProfileId, {
  label: string;
  description: string;
  template: FixtureTemplateId;
  count: number;
  groupName: string;
  namePrefix: string;
  showProfile: AssistantShowProfileId;
  controlSurface: AssistantControlSurfaceId;
}> = {
  small_bar: {
    label: 'Petit bar',
    description: 'Peu de place, contrôle tactile simple, couleurs utiles.',
    template: 'bar_rgb',
    count: 2,
    groupName: 'Piste',
    namePrefix: 'Bar',
    showProfile: 'dj',
    controlSurface: 'touch',
  },
  wedding_hall: {
    label: 'Salle mariage',
    description: 'Face propre, moments doux et piste de danse.',
    template: 'par_rgbw',
    count: 4,
    groupName: 'Face',
    namePrefix: 'Face',
    showProfile: 'wedding',
    controlSurface: 'touch',
  },
  club: {
    label: 'Club / DJ booth',
    description: 'Beams, impacts et contrôle type APC mini.',
    template: 'moving_head_spot',
    count: 4,
    groupName: 'Fond',
    namePrefix: 'Beam',
    showProfile: 'dj',
    controlSurface: 'apc_mini',
  },
  conference_room: {
    label: 'Conférence',
    description: 'Lisibilité, photo, pas de strobe agressif.',
    template: 'par_rgbw',
    count: 4,
    groupName: 'Face',
    namePrefix: 'Orateur',
    showProfile: 'conference',
    controlSurface: 'touch',
  },
  live_stage: {
    label: 'Live band',
    description: 'Face + énergie rock, pads prêts pour solos/final.',
    template: 'par_rgbw',
    count: 6,
    groupName: 'Face',
    namePrefix: 'Scene',
    showProfile: 'live_band',
    controlSurface: 'apc_mini',
  },
  mapping_room: {
    label: 'VJ / mapping',
    description: 'Lumière basse pour garder la projection lisible.',
    template: 'bar_rgb',
    count: 2,
    groupName: 'Fond',
    namePrefix: 'Mapping',
    showProfile: 'vj',
    controlSurface: 'launchpad',
  },
};

const ASSISTANT_CONTROL_SURFACES: Record<AssistantControlSurfaceId, {
  label: string;
  description: string;
  midiChannel: number;
  notes: number[];
}> = {
  touch: {
    label: 'Tablette / tactile',
    description: 'Pads à l’écran, sans note MIDI imposée.',
    midiChannel: 1,
    notes: [-1, -1, -1, -1],
  },
  apc_mini: {
    label: 'Akai APC mini',
    description: 'Première rangée de pads, canal MIDI 1.',
    midiChannel: 1,
    notes: [56, 57, 58, 59],
  },
  launchpad: {
    label: 'Launchpad',
    description: 'Rangée basse standard pour scènes rapides.',
    midiChannel: 1,
    notes: [11, 12, 13, 14],
  },
  keyboard: {
    label: 'Clavier MIDI',
    description: 'Touches C3 à D#3 pour déclenchement simple.',
    midiChannel: 1,
    notes: [60, 61, 62, 63],
  },
};

const ASSISTANT_SHOW_PROFILES: Record<AssistantShowProfileId, {
  label: string;
  description: string;
  pads: AssistantPadPreset[];
}> = {
  dj: {
    label: 'DJ / Club',
    description: 'Couleurs fortes, drop, impact et mouvement rapide.',
    pads: [
      { name: 'Warm Up', color: 'bg-cyan-500', textColor: 'text-cyan-300', iconName: 'Droplets', rgb: { r: 0, g: 90, b: 255, w: 0 }, options: { intensity: 190, strobe: 0, gobo: 1 } },
      { name: 'Build', color: 'bg-fuchsia-500', textColor: 'text-fuchsia-300', iconName: 'Sparkles', rgb: { r: 255, g: 0, b: 190, w: 0 }, options: { intensity: 235, strobe: 40, gobo: 2, prism: 100 } },
      { name: 'Drop', color: 'bg-amber-500', textColor: 'text-amber-300', iconName: 'Zap', rgb: { r: 255, g: 255, b: 255, w: 255 }, options: { intensity: 255, strobe: 220, gobo: 3, prism: 180 } },
      { name: 'Break', color: 'bg-blue-500', textColor: 'text-blue-300', iconName: 'AudioLines', rgb: { r: 0, g: 25, b: 180, w: 0 }, options: { intensity: 120, strobe: 0, gobo: 0 } },
    ],
  },
  wedding: {
    label: 'Mariage',
    description: 'Ambiances propres, chaudes, photos et moment danse.',
    pads: [
      { name: 'Accueil', color: 'bg-white', textColor: 'text-slate-900', iconName: 'Droplets', rgb: { r: 255, g: 210, b: 150, w: 220 }, options: { intensity: 155, strobe: 0 } },
      { name: 'Discours', color: 'bg-amber-500', textColor: 'text-amber-300', iconName: 'Activity', rgb: { r: 255, g: 190, b: 90, w: 255 }, options: { intensity: 205, strobe: 0, center: true } },
      { name: 'Ouverture', color: 'bg-pink-500', textColor: 'text-pink-300', iconName: 'Sparkles', rgb: { r: 255, g: 90, b: 180, w: 80 }, options: { intensity: 185, strobe: 0, gobo: 1 } },
      { name: 'Dance', color: 'bg-purple-500', textColor: 'text-purple-300', iconName: 'Zap', rgb: { r: 180, g: 0, b: 255, w: 0 }, options: { intensity: 245, strobe: 80, gobo: 2, prism: 140 } },
    ],
  },
  conference: {
    label: 'Conférence',
    description: 'Face lisible, scène calme, accents sans strobe agressif.',
    pads: [
      { name: 'Orateur', color: 'bg-white', textColor: 'text-slate-900', iconName: 'Activity', rgb: { r: 255, g: 220, b: 170, w: 255 }, options: { intensity: 225, strobe: 0 } },
      { name: 'Panel', color: 'bg-cyan-500', textColor: 'text-cyan-300', iconName: 'Droplets', rgb: { r: 80, g: 180, b: 255, w: 130 }, options: { intensity: 165, strobe: 0 } },
      { name: 'Pause', color: 'bg-blue-500', textColor: 'text-blue-300', iconName: 'AudioLines', rgb: { r: 20, g: 70, b: 190, w: 40 }, options: { intensity: 95, strobe: 0 } },
      { name: 'Photo', color: 'bg-amber-500', textColor: 'text-amber-300', iconName: 'Zap', rgb: { r: 255, g: 255, b: 255, w: 255 }, options: { intensity: 255, strobe: 0 } },
    ],
  },
  theatre: {
    label: 'Théâtre',
    description: 'Chaud, froid, contre-jour et noir doux.',
    pads: [
      { name: 'Chaud', color: 'bg-amber-500', textColor: 'text-amber-300', iconName: 'Flame', rgb: { r: 255, g: 150, b: 70, w: 180 }, options: { intensity: 175, strobe: 0 } },
      { name: 'Froid', color: 'bg-blue-500', textColor: 'text-blue-300', iconName: 'Droplets', rgb: { r: 30, g: 90, b: 255, w: 80 }, options: { intensity: 145, strobe: 0 } },
      { name: 'Dramatique', color: 'bg-red-500', textColor: 'text-red-300', iconName: 'Activity', rgb: { r: 255, g: 25, b: 10, w: 0 }, options: { intensity: 160, strobe: 0, gobo: 2 } },
      { name: 'Noir doux', color: 'bg-slate-700', textColor: 'text-slate-300', iconName: 'Zap', rgb: { r: 0, g: 0, b: 30, w: 0 }, options: { intensity: 35, strobe: 0 } },
    ],
  },
  live_band: {
    label: 'Live Band',
    description: 'Face propre, énergie rock, solo et final.',
    pads: [
      { name: 'Face', color: 'bg-white', textColor: 'text-slate-900', iconName: 'Activity', rgb: { r: 255, g: 210, b: 160, w: 240 }, options: { intensity: 220, strobe: 0 } },
      { name: 'Rock', color: 'bg-red-500', textColor: 'text-red-300', iconName: 'Flame', rgb: { r: 255, g: 20, b: 10, w: 0 }, options: { intensity: 235, strobe: 35, gobo: 1 } },
      { name: 'Solo', color: 'bg-blue-500', textColor: 'text-blue-300', iconName: 'Droplets', rgb: { r: 20, g: 90, b: 255, w: 120 }, options: { intensity: 210, strobe: 0, gobo: 3 } },
      { name: 'Final', color: 'bg-amber-500', textColor: 'text-amber-300', iconName: 'Zap', rgb: { r: 255, g: 255, b: 255, w: 255 }, options: { intensity: 255, strobe: 150, prism: 160 } },
    ],
  },
  vj: {
    label: 'VJ / Mapping',
    description: 'Lumière contrôlée pour ne pas écraser la projection.',
    pads: [
      { name: 'Mapping Clean', color: 'bg-white', textColor: 'text-slate-900', iconName: 'Activity', rgb: { r: 255, g: 255, b: 255, w: 180 }, options: { intensity: 120, strobe: 0 } },
      { name: 'Silhouette', color: 'bg-blue-500', textColor: 'text-blue-300', iconName: 'Droplets', rgb: { r: 0, g: 20, b: 120, w: 0 }, options: { intensity: 80, strobe: 0, center: true } },
      { name: 'Pulse', color: 'bg-purple-500', textColor: 'text-purple-300', iconName: 'AudioLines', rgb: { r: 130, g: 0, b: 255, w: 0 }, options: { intensity: 145, strobe: 45, gobo: 1 } },
      { name: 'Flash Sync', color: 'bg-cyan-500', textColor: 'text-cyan-300', iconName: 'Zap', rgb: { r: 180, g: 255, b: 255, w: 255 }, options: { intensity: 210, strobe: 180, prism: 120 } },
    ],
  },
};

const BEGINNER_GOALS: Array<{
  id: string;
  title: string;
  description: string;
  template: FixtureTemplateId;
  count: number;
  groupName: string;
  namePrefix: string;
}> = [
  {
    id: 'front_wash',
    title: 'Éclairer des personnes',
    description: 'Face propre pour chanteur, DJ, discours ou scène.',
    template: 'par_rgbw',
    count: 4,
    groupName: 'Face',
    namePrefix: 'Face',
  },
  {
    id: 'dancefloor_color',
    title: 'Colorer une piste',
    description: 'Couleurs simples et contrôlables pour dancefloor.',
    template: 'bar_rgb',
    count: 2,
    groupName: 'Piste',
    namePrefix: 'Piste',
  },
  {
    id: 'back_beams',
    title: 'Ajouter des beams',
    description: 'Lyres ou beams derrière la scène, centrés automatiquement.',
    template: 'moving_head_spot',
    count: 2,
    groupName: 'Fond',
    namePrefix: 'Lyre Fond',
  },
  {
    id: 'impact',
    title: 'Créer des impacts',
    description: 'Strobes, blinders ou accents puissants pour les drops.',
    template: 'strobe',
    count: 2,
    groupName: 'Dancefloor',
    namePrefix: 'Impact',
  },
];

const BEGINNER_FIXTURE_TEMPLATES: Record<FixtureTemplateId, {
  label: string;
  manufacturer: string;
  modeName: string;
  groupName: string;
  channels: Array<{ channel: number; name: string; type: string; min: number; max: number }>;
}> = {
  par_rgbw: {
    label: 'PAR LED RGBW',
    manufacturer: 'Generic',
    modeName: 'Simple RGBW Dimmer (6ch)',
    groupName: 'Face',
    channels: [
      { channel: 1, name: 'Dimmer', type: 'dimmer', min: 0, max: 255 },
      { channel: 2, name: 'Red', type: 'red', min: 0, max: 255 },
      { channel: 3, name: 'Green', type: 'green', min: 0, max: 255 },
      { channel: 4, name: 'Blue', type: 'blue', min: 0, max: 255 },
      { channel: 5, name: 'White', type: 'white', min: 0, max: 255 },
      { channel: 6, name: 'Strobe', type: 'strobe', min: 0, max: 255 },
    ],
  },
  moving_head_spot: {
    label: 'Lyre Spot / Beam',
    manufacturer: 'Generic',
    modeName: 'Beginner Moving Head (12ch)',
    groupName: 'Fond',
    channels: [
      { channel: 1, name: 'Pan', type: 'pan', min: 0, max: 255 },
      { channel: 2, name: 'Pan Fine', type: 'pan_fine', min: 0, max: 255 },
      { channel: 3, name: 'Tilt', type: 'tilt', min: 0, max: 255 },
      { channel: 4, name: 'Tilt Fine', type: 'tilt_fine', min: 0, max: 255 },
      { channel: 5, name: 'Speed', type: 'speed', min: 0, max: 255 },
      { channel: 6, name: 'Dimmer', type: 'dimmer', min: 0, max: 255 },
      { channel: 7, name: 'Strobe', type: 'strobe', min: 0, max: 255 },
      { channel: 8, name: 'Color Wheel', type: 'color_wheel', min: 0, max: 255 },
      { channel: 9, name: 'Gobo', type: 'gobo', min: 0, max: 255 },
      { channel: 10, name: 'Prism', type: 'prism', min: 0, max: 255 },
      { channel: 11, name: 'Focus', type: 'focus', min: 0, max: 255 },
      { channel: 12, name: 'Reset', type: 'reset', min: 0, max: 255 },
    ],
  },
  bar_rgb: {
    label: 'Barre LED RGB',
    manufacturer: 'Generic',
    modeName: 'RGB Bar Simple (8ch)',
    groupName: 'Piste',
    channels: [
      { channel: 1, name: 'Dimmer', type: 'dimmer', min: 0, max: 255 },
      { channel: 2, name: 'Red 1', type: 'red', min: 0, max: 255 },
      { channel: 3, name: 'Green 1', type: 'green', min: 0, max: 255 },
      { channel: 4, name: 'Blue 1', type: 'blue', min: 0, max: 255 },
      { channel: 5, name: 'Red 2', type: 'red', min: 0, max: 255 },
      { channel: 6, name: 'Green 2', type: 'green', min: 0, max: 255 },
      { channel: 7, name: 'Blue 2', type: 'blue', min: 0, max: 255 },
      { channel: 8, name: 'Strobe', type: 'strobe', min: 0, max: 255 },
    ],
  },
  strobe: {
    label: 'Strobe / Blinder',
    manufacturer: 'Generic',
    modeName: 'Intensity Strobe (2ch)',
    groupName: 'Dancefloor',
    channels: [
      { channel: 1, name: 'Dimmer', type: 'dimmer', min: 0, max: 255 },
      { channel: 2, name: 'Strobe', type: 'strobe', min: 0, max: 255 },
    ],
  },
};

const DEFAULT_GROUPS = [
  { name: 'Master', role: 'master', color: '#06b6d4' },
  { name: 'Piste', role: 'dancefloor', color: '#a855f7' },
  { name: 'Bar', role: 'bar', color: '#22c55e' },
  { name: 'Dancefloor', role: 'dancefloor', color: '#ec4899' },
  { name: 'Face', role: 'front', color: '#facc15' },
  { name: 'Fond', role: 'back', color: '#f97316' },
];

// ─── Universe grid (512 channels, 32 columns) ─────────────────────
function UniverseGrid({
  universeNum,
  fixtures,
  selectedId,
  onSelect,
}: {
  universeNum: number;
  fixtures: PatchedFixture[];
  selectedId: string | null;
  onSelect: (id: string, event: React.MouseEvent) => void;
}) {
  const COLS = 32;
  const TOTAL = 512;

  // Build channel → fixture map
  const channelMap = new Map<number, PatchedFixture>();
  fixtures
    .filter(f => f.universe === universeNum)
    .forEach(f => {
      for (let i = 0; i < f.totalChannels; i++) {
        channelMap.set(f.startAddress + i, f);
      }
    });

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Universe {universeNum}
        </span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const ch = i + 1;
          const fixture = channelMap.get(ch);
          const isFirst = fixture && fixture.startAddress === ch;
          const isSelected = fixture?.nodeId === selectedId;

          return (
            <div
              key={ch}
              onClick={(e) => fixture && onSelect(fixture.nodeId, e)}
              title={fixture ? `${fixture.name} · CH ${ch}` : `CH ${ch}`}
              className={`
                relative h-7 flex items-center justify-center text-[9px] font-mono
                transition-all duration-100 select-none
                ${fixture
                  ? `cursor-pointer ${isSelected ? 'ring-1 ring-white/80 z-10' : ''}`
                  : 'bg-[#0d0f14] text-slate-700 hover:bg-white/5 hover:text-slate-500'
                }
              `}
              style={fixture ? {
                backgroundColor: isSelected
                  ? fixture.color
                  : fixture.color + '55',
                color: isSelected ? '#000' : fixture.color,
                fontWeight: isFirst ? 900 : 400,
              } : undefined}
            >
              {isFirst ? (
                <span className="truncate px-0.5 text-[8px] font-black leading-none">
                  {ch}
                </span>
              ) : (
                <span className="text-current opacity-60">{ch}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PendingPatch {
  id: number;
  name: string;
  totalChannels: number;
  startAddress: number;
}

type DmxChannelDefinition = {
  channel?: number;
  type?: string;
  function?: string;
  name?: string;
  label?: string;
};

const normalizeDmxText = (value: unknown) =>
  String(value ?? '').toLowerCase().replace(/[_-]/g, ' ');

const channelMatches = (channel: DmxChannelDefinition, terms: string[]) => {
  const haystack = normalizeDmxText([
    channel.type,
    channel.function,
    channel.name,
    channel.label,
  ].filter(Boolean).join(' '));
  return terms.some(term => haystack.includes(term));
};

const findRelativeChannel = (
  channels: DmxChannelDefinition[],
  terms: string[],
) => channels.find(channel => channelMatches(channel, terms))?.channel ?? null;

// ─── Main PatchPanel ──────────────────────────────────────────────
export default function PatchPanel() {
  const router = useRouter();
  const {
    nodes, updateNodeData, addNode, addToast, onNodesChange,
    selectedFixtureId, setSelectedFixtureId,
    selectedFixtureIds, setSelectedFixtureIds,
    setIsBottomPanelVisible,
    smartPads,
    addSmartPad,
    currentProjectName,
    showLock,
  } = useStore();

  // Helper to find next free contiguous address block in a universe
  const findNextFreeAddress = (totalChannels: number, universe: number, excludeNodeId?: string) => {
    const busyChannels = new Set<number>();
    patchedFixtures
      .filter(f => f.universe === universe && f.nodeId !== excludeNodeId)
      .forEach(f => {
        for (let i = 0; i < f.totalChannels; i++) {
          busyChannels.add(f.startAddress + i);
        }
      });

    for (let addr = 1; addr <= 512 - totalChannels + 1; addr++) {
      let conflict = false;
      for (let i = 0; i < totalChannels; i++) {
        if (busyChannels.has(addr + i)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) return addr;
    }
    return 1;
  };

  const [activeTab, setActiveTab] = useState<'assistant' | 'patch' | 'scan' | 'layout'>('patch');
  const [libraryFixtures, setLibraryFixtures] = useState<LibraryFixture[]>([]);
  const [fixtureGroups, setFixtureGroups] = useState<FixtureGroup[]>([]);
  const [savedVenueProfiles, setSavedVenueProfiles] = useState<SavedVenueProfile[]>([]);
  const [customVenueName, setCustomVenueName] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState(DEFAULT_GROUPS[0].name);
  const [groupSaving, setGroupSaving] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeUniverse, setActiveUniverse] = useState(1);
  const [showProfileBuilder, setShowProfileBuilder] = useState(false);
  const [assistantVenueProfile, setAssistantVenueProfile] = useState<AssistantVenueProfileId>('wedding_hall');
  const [assistantGoalId, setAssistantGoalId] = useState(BEGINNER_GOALS[0].id);
  const [assistantTemplate, setAssistantTemplate] = useState<FixtureTemplateId>('par_rgbw');
  const [assistantCount, setAssistantCount] = useState(4);
  const [assistantUniverse, setAssistantUniverse] = useState(1);
  const [assistantGroupName, setAssistantGroupName] = useState('Face');
  const [assistantNamePrefix, setAssistantNamePrefix] = useState('Face');
  const [assistantCreateShow, setAssistantCreateShow] = useState(true);
  const [assistantShowProfile, setAssistantShowProfile] = useState<AssistantShowProfileId>('dj');
  const [assistantControlSurface, setAssistantControlSurface] = useState<AssistantControlSurfaceId>('touch');
  const [quickDmxValues, setQuickDmxValues] = useState<Record<string, number>>({});
  const [assistantSaving, setAssistantSaving] = useState(false);
  const [socketReady, setSocketReady] = useState(socket.connected);
  const [licenseSnapshot, setLicenseSnapshot] = useState<LicenseSnapshot | null>(null);

  const handleSelect = (nodeId: string | null, event?: React.MouseEvent) => {
    setIsBottomPanelVisible(true);
    if (!nodeId) {
      setSelectedFixtureId(null);
      setSelectedFixtureIds([]);
      return;
    }
    if (event && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      if (selectedFixtureIds.includes(nodeId)) {
        const next = selectedFixtureIds.filter(id => id !== nodeId);
        setSelectedFixtureIds(next);
        if (selectedFixtureId === nodeId) {
          setSelectedFixtureId(next[0] || null);
        }
      } else {
        const next = [...selectedFixtureIds, nodeId];
        setSelectedFixtureIds(next);
        setSelectedFixtureId(nodeId);
      }
    } else {
      setSelectedFixtureId(nodeId);
      setSelectedFixtureIds([nodeId]);
    }
  };

  const loadLibraryFixtures = () => {
    fetch(`${API_BASE}/api/fixtures`)
      .then(r => r.ok ? r.json() : [])
      .then(setLibraryFixtures)
      .catch(() => {});
  };

  const loadFixtureGroups = () => {
    fetch(`${API_BASE}/api/fixture-groups`)
      .then(r => r.ok ? r.json() : [])
      .then(setFixtureGroups)
      .catch(() => {});
  };

  const loadLicenseSnapshot = () => {
    fetch(`${API_BASE}/api/license`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setLicenseSnapshot(data))
      .catch(() => setLicenseSnapshot(null));
  };

  const loadSavedVenueProfiles = () => {
    fetch(`${API_BASE}/api/venue-profiles`)
      .then(r => r.ok ? r.json() : [])
      .then(setSavedVenueProfiles)
      .catch(() => setSavedVenueProfiles([]));
  };

  // ── Pending patch (après sauvegarde scan ou ajout bibliothèque) ─
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);
  const [patchUniverse, setPatchUniverse] = useState(1);
  const [patchAddress, setPatchAddress] = useState(1);

  // ── Ajout depuis bibliothèque ────────────────────────────────────
  const [showAddFromLib, setShowAddFromLib] = useState(false);
  const [addLibSearch, setAddLibSearch] = useState('');

  // ── Patcher la fixture dans le canvas / store ──────────────────
  const confirmPatch = () => {
    if (!pendingPatch) return;
    addNode({
      id: `fixture-${Date.now()}`,
      type: 'fixtureNode',
      position: { x: 120 + patchedFixtures.length * 30, y: 120 },
      data: {
        label: pendingPatch.name,
        fixtureName: pendingPatch.name,
        fixtureId: pendingPatch.id,
        totalChannels: pendingPatch.totalChannels,
        startAddress: patchAddress,
        universe: patchUniverse,
        channels: [],
        modes: [],
      },
    });
    addToast({
      type: 'success',
      message: `${pendingPatch.name} patchée`,
      detail: `Universe ${patchUniverse} · CH ${patchAddress}–${patchAddress + pendingPatch.totalChannels - 1}`,
    });
    setPendingPatch(null);
    setActiveUniverse(patchUniverse);
    setActiveTab('patch');
  };

  // Load fixture library
  useEffect(() => {
    loadLibraryFixtures();
    loadFixtureGroups();
    loadLicenseSnapshot();
    loadSavedVenueProfiles();
  }, []);

  useEffect(() => {
    const update = () => setSocketReady(socket.connected);
    update();
    socket.on('connect', update);
    socket.on('disconnect', update);
    return () => {
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, []);

  // Build patched fixtures from canvas nodes
  const patchedFixtures: PatchedFixture[] = nodes
    .filter(n => n.type === 'fixtureNode' || n.type === 'dmxOutput' || n.type === 'artnetOut')
    .map((n, i) => ({
      nodeId: n.id,
      fixtureId: n.data.fixtureId !== undefined ? Number(n.data.fixtureId) : undefined,
      name: String(n.data.fixtureName ?? n.data.label ?? n.type),
      universe: Number(n.data.universe ?? 1),
      startAddress: Number(n.data.startAddress ?? n.data.channel ?? 1),
      totalChannels: Number(n.data.totalChannels ?? 1),
      color: COLORS[i % COLORS.length],
      nodeType: n.type ?? '',
    }));

  // Universes that have fixtures
  const usedUniverses = [...new Set(patchedFixtures.map(f => f.universe))].sort();

  const selectedGroup =
    fixtureGroups.find(g => g.name.toLowerCase() === selectedGroupName.toLowerCase()) ?? null;

  const assistantTemplateDefinition = BEGINNER_FIXTURE_TEMPLATES[assistantTemplate];
  const assistantFirstAddress = findNextFreeAddress(assistantTemplateDefinition.channels.length, assistantUniverse);
  const assistantLastAddress = assistantFirstAddress + assistantTemplateDefinition.channels.length * assistantCount - 1;
  const assistantControlDefinition = ASSISTANT_CONTROL_SURFACES[assistantControlSurface];
  const assistantGroupExists = fixtureGroups.some(group => group.name.toLowerCase() === assistantGroupName.toLowerCase());
  const hasMappedMidi = assistantControlDefinition.notes.some(note => note >= 0);
  const licenseReady =
    !licenseSnapshot ||
    licenseSnapshot.mode === 'activated' ||
    (licenseSnapshot.mode === 'trial' && (licenseSnapshot.trialDaysRemaining ?? 1) > 0);
  const readinessItems = [
    {
      label: 'Backend live',
      ok: socketReady,
      detail: socketReady ? 'Connecté' : 'Serveur ou socket hors ligne',
    },
    {
      label: 'Licence',
      ok: licenseReady,
      warn: !!licenseSnapshot && !licenseSnapshot.offlineReady,
      detail: licenseSnapshot
        ? `${licenseSnapshot.mode}${licenseSnapshot.offlineReady ? ' · offline prêt' : ' · offline à préparer'}`
        : 'Non vérifiée',
    },
    {
      label: 'Patch DMX',
      ok: assistantLastAddress <= 512,
      detail: `U${assistantUniverse} CH${assistantFirstAddress}-${assistantLastAddress}`,
    },
    {
      label: 'Groupe live',
      ok: assistantGroupExists || assistantCreateShow,
      warn: !assistantGroupExists,
      detail: assistantGroupExists ? `${assistantGroupName} existe` : `${assistantGroupName} sera créé`,
    },
    {
      label: 'Pads show',
      ok: assistantCreateShow || smartPads.length > 0,
      detail: assistantCreateShow ? '4 pads générés' : `${smartPads.length} pad(s) existant(s)`,
    },
    {
      label: 'Contrôle',
      ok: assistantControlSurface === 'touch' || hasMappedMidi,
      warn: assistantControlSurface === 'touch',
      detail: assistantControlDefinition.label,
    },
    {
      label: 'Projet',
      ok: !!currentProjectName,
      warn: currentProjectName === 'Untitled Project',
      detail: currentProjectName || 'Projet sans nom',
    },
    {
      label: 'Show Lock',
      ok: true,
      warn: !showLock,
      detail: showLock ? 'Actions dangereuses verrouillées' : 'Désactivé',
    },
  ];

  const saveSelectedGroup = async () => {
    const definition = DEFAULT_GROUPS.find(g => g.name === selectedGroupName) ?? DEFAULT_GROUPS[0];
    const fixtureIds = patchedFixtures
      .filter(f => selectedFixtureIds.includes(f.nodeId) && Number.isFinite(f.fixtureId))
      .map(f => Number(f.fixtureId));

    if (fixtureIds.length === 0) {
      addToast({
        type: 'error',
        message: 'Aucune fixture valide sélectionnée',
        detail: 'Sélectionnez des fixtures patchées depuis la liste ou le plan.',
      });
      return;
    }

    setGroupSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/fixture-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedGroup?.id,
          name: selectedGroupName,
          role: definition.role,
          color: definition.color,
          fixtureIds,
        }),
      });
      if (!response.ok) throw new Error('group_save_failed');
      await loadFixtureGroups();
      addToast({
        type: 'success',
        message: `Groupe ${selectedGroupName} enregistré`,
        detail: `${fixtureIds.length} fixture(s) assignée(s).`,
      });
    } catch {
      addToast({ type: 'error', message: 'Impossible de sauvegarder le groupe' });
    } finally {
      setGroupSaving(false);
    }
  };

  const selectGroupFixtures = () => {
    if (!selectedGroup) return;
    const ids = patchedFixtures
      .filter(f => f.fixtureId !== undefined && selectedGroup.fixtureIds.includes(f.fixtureId))
      .map(f => f.nodeId);
    setSelectedFixtureIds(ids);
    setSelectedFixtureId(ids[0] || null);
  };

  const applyVenueProfile = (id: AssistantVenueProfileId) => {
    const profile = ASSISTANT_VENUE_PROFILES[id];
    setAssistantVenueProfile(id);
    setAssistantTemplate(profile.template);
    setAssistantCount(profile.count);
    setAssistantGroupName(profile.groupName);
    setAssistantNamePrefix(profile.namePrefix);
    setAssistantShowProfile(profile.showProfile);
    setAssistantControlSurface(profile.controlSurface);
    setAssistantCreateShow(true);
  };

  const applySavedVenueProfile = (profile: SavedVenueProfile) => {
    const data = profile.data || {};
    if (data.template && BEGINNER_FIXTURE_TEMPLATES[data.template]) setAssistantTemplate(data.template);
    if (data.count) setAssistantCount(Math.max(1, Math.min(32, Number(data.count) || 1)));
    if (data.universe) setAssistantUniverse(Math.max(1, Math.min(4, Number(data.universe) || 1)));
    if (data.groupName) setAssistantGroupName(data.groupName);
    if (data.namePrefix) setAssistantNamePrefix(data.namePrefix);
    if (data.showProfile && ASSISTANT_SHOW_PROFILES[data.showProfile]) setAssistantShowProfile(data.showProfile);
    if (data.controlSurface && ASSISTANT_CONTROL_SURFACES[data.controlSurface]) setAssistantControlSurface(data.controlSurface);
    if (data.createShow !== undefined) setAssistantCreateShow(Boolean(data.createShow));
    setCustomVenueName(profile.name);
  };

  const saveCurrentVenueProfile = async () => {
    const name = customVenueName.trim();
    if (!name) {
      addToast({ type: 'error', message: 'Nom du lieu requis' });
      return;
    }

    setVenueSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/venue-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          data: {
            template: assistantTemplate,
            count: assistantCount,
            universe: assistantUniverse,
            groupName: assistantGroupName,
            namePrefix: assistantNamePrefix,
            showProfile: assistantShowProfile,
            controlSurface: assistantControlSurface,
            createShow: assistantCreateShow,
          },
        }),
      });
      if (!response.ok) throw new Error('venue_save_failed');
      await loadSavedVenueProfiles();
      addToast({ type: 'success', message: `Lieu "${name}" sauvegardé` });
    } catch {
      addToast({ type: 'error', message: 'Impossible de sauvegarder le lieu' });
    } finally {
      setVenueSaving(false);
    }
  };

  const deleteSavedVenueProfile = async (profile: SavedVenueProfile) => {
    if (showLock) {
      addToast({
        type: 'error',
        message: 'Show Lock actif',
        detail: 'Désactivez le verrou pour supprimer un lieu.',
      });
      return;
    }
    if (!window.confirm(`Supprimer le lieu "${profile.name}" ?`)) return;
    try {
      await fetch(`${API_BASE}/api/venue-profiles/${profile.id}`, { method: 'DELETE' });
      await loadSavedVenueProfiles();
      addToast({ type: 'success', message: `Lieu "${profile.name}" supprimé` });
    } catch {
      addToast({ type: 'error', message: 'Impossible de supprimer le lieu' });
    }
  };

  const applyBeginnerGoal = (goal: typeof BEGINNER_GOALS[number]) => {
    setAssistantGoalId(goal.id);
    setAssistantTemplate(goal.template);
    setAssistantCount(goal.count);
    setAssistantGroupName(goal.groupName);
    setAssistantNamePrefix(goal.namePrefix);
    if (goal.id === 'front_wash') setAssistantShowProfile('conference');
    if (goal.id === 'dancefloor_color') setAssistantShowProfile('dj');
    if (goal.id === 'back_beams') setAssistantShowProfile('live_band');
    if (goal.id === 'impact') setAssistantShowProfile('dj');
  };

  const buildCommandsForFixture = (
    universe: number,
    startAddress: number,
    channels: typeof BEGINNER_FIXTURE_TEMPLATES[FixtureTemplateId]['channels'],
    color: { r: number; g: number; b: number; w?: number },
    options: { intensity?: number; strobe?: number; gobo?: number; prism?: number; center?: boolean } = {},
  ): AssistantDmxCommand[] => {
    const commands: AssistantDmxCommand[] = [];
    const intensity = options.intensity ?? 220;

    channels.forEach((channel) => {
      const absoluteChannel = startAddress + channel.channel - 1;
      let value: number | null = null;

      switch (channel.type) {
        case 'dimmer':
        case 'intensity':
        case 'shutter':
          value = intensity;
          break;
        case 'red':
          value = color.r;
          break;
        case 'green':
          value = color.g;
          break;
        case 'blue':
          value = color.b;
          break;
        case 'white':
          value = color.w ?? 0;
          break;
        case 'amber':
          value = Math.round((color.r + color.g) / 3);
          break;
        case 'uv':
          value = Math.max(color.b, color.r > color.g ? 120 : 0);
          break;
        case 'strobe':
          value = options.strobe ?? 0;
          break;
        case 'pan':
        case 'tilt':
          value = options.center === false ? null : 127;
          break;
        case 'pan_fine':
        case 'tilt_fine':
          value = options.center === false ? null : 0;
          break;
        case 'speed':
          value = 90;
          break;
        case 'color_wheel':
          value = color.b > color.r && color.b > color.g ? 125 : color.r > color.g ? 15 : color.g > color.r ? 45 : 5;
          break;
        case 'gobo':
          value = options.gobo ?? 0;
          break;
        case 'prism':
          value = options.prism ?? 0;
          break;
        default:
          value = null;
      }

      if (value !== null) {
        commands.push({ universe, channel: absoluteChannel, value: Math.max(0, Math.min(255, value)) });
      }
    });

    return commands;
  };

  const createStarterPads = (
    createdFixtures: Array<{
      universe: number;
      startAddress: number;
      channels: typeof BEGINNER_FIXTURE_TEMPLATES[FixtureTemplateId]['channels'];
    }>,
  ) => {
    const nextWidget = smartPads.length > 0 ? Math.max(...smartPads.map(pad => pad.qlcWidget)) + 1 : 20;
    const nextId = smartPads.length > 0 ? Math.max(...smartPads.map(pad => pad.id)) + 1 : 1;
    const padPresets = ASSISTANT_SHOW_PROFILES[assistantShowProfile].pads;
    const controlSurface = ASSISTANT_CONTROL_SURFACES[assistantControlSurface];

    padPresets.forEach((preset, index) => {
      const dmxCommands = createdFixtures.flatMap(fixture =>
        buildCommandsForFixture(fixture.universe, fixture.startAddress, fixture.channels, preset.rgb, preset.options),
      );

      addSmartPad({
        id: nextId + index,
        name: `${assistantGroupName} ${preset.name}`,
        color: preset.color,
        textColor: preset.textColor,
        iconName: preset.iconName,
        qlcPage: 1,
        qlcWidget: nextWidget + index,
        dmxCommands,
        midiNote: controlSurface.notes[index] ?? -1,
        midiChannel: controlSurface.midiChannel,
        gridCol: index % 4,
        gridRow: Math.floor(index / 4),
        gridW: 1,
        gridH: 1,
      });
    });
  };

  const runBeginnerAssistant = async () => {
    const template = BEGINNER_FIXTURE_TEMPLATES[assistantTemplate];
    const totalChannels = template.channels.length;
    const firstAddress = findNextFreeAddress(totalChannels, assistantUniverse);
    const lastAddress = firstAddress + totalChannels * assistantCount - 1;

    if (lastAddress > 512) {
      addToast({
        type: 'error',
        message: 'Pas assez de place dans cet univers',
        detail: `${assistantCount} x ${totalChannels} canaux dépasserait le canal 512.`,
      });
      return;
    }

    setAssistantSaving(true);
    try {
      const createdFixtureIds: number[] = [];
      const createdNodeIds: string[] = [];
      const createdFixturesForShow: Array<{
        universe: number;
        startAddress: number;
        channels: typeof template.channels;
      }> = [];

      for (let index = 0; index < assistantCount; index++) {
        const startAddress = firstAddress + index * totalChannels;
        const fixtureName = `${assistantNamePrefix || template.label} ${index + 1}`;
        const response = await fetch(`${API_BASE}/api/fixtures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fixtureName,
            manufacturer: template.manufacturer,
            channels: template.channels,
            notes: `Assistant débutant · ${template.label} · ${template.modeName}`,
            startAddress,
            modes: [{
              name: template.modeName,
              channels: template.channels.map(channel => channel.type),
            }],
          }),
        });
        if (!response.ok) throw new Error('fixture_create_failed');
        const saved = await response.json();
        const fixtureId = Number(saved.id);
        const nodeId = `fixture-${Date.now()}-${index}`;
        createdFixtureIds.push(fixtureId);
        createdNodeIds.push(nodeId);
        createdFixturesForShow.push({
          universe: assistantUniverse,
          startAddress,
          channels: template.channels,
        });

        addNode({
          id: nodeId,
          type: 'fixtureNode',
          position: { x: 120 + (index % 6) * 120, y: 120 + Math.floor(index / 6) * 110 },
          data: {
            label: fixtureName,
            fixtureName,
            fixtureId,
            totalChannels,
            startAddress,
            universe: assistantUniverse,
            channels: template.channels,
            modes: [{ name: template.modeName, channels: template.channels.map(channel => channel.type) }],
          },
        });
      }

      const definition =
        DEFAULT_GROUPS.find(group => group.name === assistantGroupName) ??
        { name: assistantGroupName, role: 'custom', color: '#06b6d4' };
      const existingGroup = fixtureGroups.find(group => group.name.toLowerCase() === assistantGroupName.toLowerCase());
      const mergedFixtureIds = Array.from(new Set([...(existingGroup?.fixtureIds || []), ...createdFixtureIds]));

      await fetch(`${API_BASE}/api/fixture-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingGroup?.id,
          name: assistantGroupName,
          role: definition.role,
          color: definition.color,
          fixtureIds: mergedFixtureIds,
        }),
      });

      await loadLibraryFixtures();
      await loadFixtureGroups();
      if (assistantCreateShow) {
        createStarterPads(createdFixturesForShow);
      }
      setSelectedFixtureIds(createdNodeIds);
      setSelectedFixtureId(createdNodeIds[0] || null);
      setActiveUniverse(assistantUniverse);
      setActiveTab('patch');
      addToast({
        type: 'success',
        message: `${assistantCount} fixture(s) patchée(s)`,
        detail: `U${assistantUniverse} CH${firstAddress}-${lastAddress} · groupe ${assistantGroupName}`,
      });
    } catch {
      addToast({ type: 'error', message: "L'assistant n'a pas pu créer le patch" });
    } finally {
      setAssistantSaving(false);
    }
  };

  const filteredLibrary = libraryFixtures.filter(f =>
    f.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
    (f.manufacturer ?? '').toLowerCase().includes(librarySearch.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#080a0e]">

      {/* ── TOP TAB BAR ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 border-b border-white/5 bg-[#0a0c10] shrink-0">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'assistant'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          ASSISTANT DEBUTANT
        </button>
        <button
          onClick={() => setActiveTab('patch')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'patch'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          UNIVERSE PATCH
        </button>
        <button
          onClick={() => setActiveTab('layout')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'layout'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Move className="w-3.5 h-3.5" />
          PLAN DE FEU
        </button>
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'scan'
              ? 'border-purple-400 text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <ScanLine className="w-3.5 h-3.5" />
          SCAN FIXTURE IA
          {libraryFixtures.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-[9px] font-black">
              {libraryFixtures.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────── */}
      {activeTab === 'assistant' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-5">
              <div>
                <p className="text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Assistant patch débutant
                </p>
                <h3 className="text-white text-lg font-black mt-2">Créer et patcher des projecteurs automatiquement</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Choisissez un type, un nombre de projecteurs et un groupe live. Glow Logic crée les fixtures, trouve une adresse DMX libre et les assigne au contrôle tactile.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Lieu</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {Object.entries(ASSISTANT_VENUE_PROFILES).map(([id, profile]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyVenueProfile(id as AssistantVenueProfileId)}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        assistantVenueProfile === id
                          ? 'bg-violet-500/10 border-violet-400/50'
                          : 'bg-black/25 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <p className="text-white text-xs font-bold">{profile.label}</p>
                      <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">{profile.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <input
                    value={customVenueName}
                    onChange={e => setCustomVenueName(e.target.value)}
                    placeholder="Nom du lieu"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-400/50"
                  />
                  <button
                    type="button"
                    onClick={saveCurrentVenueProfile}
                    disabled={venueSaving}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-xs font-bold disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {venueSaving ? 'Sauvegarde...' : 'Sauver lieu'}
                  </button>
                </div>

                {savedVenueProfiles.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {savedVenueProfiles.map(profile => (
                      <div key={profile.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2">
                        <button
                          type="button"
                          onClick={() => applySavedVenueProfile(profile)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-white text-xs font-bold truncate">{profile.name}</p>
                          <p className="text-slate-500 text-[10px] truncate">
                            {profile.data?.groupName || 'Groupe'} · {profile.data?.count || 1} fixture(s)
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedVenueProfile(profile)}
                          className="w-7 h-7 rounded-lg border border-white/5 text-slate-500 hover:text-red-300 hover:border-red-400/30 flex items-center justify-center"
                          title="Supprimer ce lieu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Je veux...</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {BEGINNER_GOALS.map(goal => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => applyBeginnerGoal(goal)}
                      className={`text-left rounded-xl border p-4 transition-all ${
                        assistantGoalId === goal.id
                          ? 'bg-cyan-500/10 border-cyan-400/50'
                          : 'bg-black/25 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <p className="text-white text-sm font-bold">{goal.title}</p>
                      <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">{goal.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(BEGINNER_FIXTURE_TEMPLATES).map(([id, template]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setAssistantTemplate(id as FixtureTemplateId);
                      setAssistantGroupName(template.groupName);
                      setAssistantNamePrefix(template.groupName);
                    }}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      assistantTemplate === id
                        ? 'bg-emerald-500/10 border-emerald-400/50 shadow-[0_0_18px_rgba(16,185,129,0.08)]'
                        : 'bg-black/25 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <p className="text-white text-sm font-bold">{template.label}</p>
                    <p className="text-slate-500 text-[11px] mt-1">{template.modeName} · {template.channels.length} ch</p>
                    <p className="text-emerald-400/80 text-[10px] font-bold mt-2 uppercase">Groupe conseillé: {template.groupName}</p>
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Nombre</span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={assistantCount}
                    onChange={e => setAssistantCount(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400/50"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Univers</span>
                  <select
                    value={assistantUniverse}
                    onChange={e => setAssistantUniverse(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400/50"
                  >
                    {[1, 2, 3, 4].map(universe => <option key={universe} value={universe}>U{universe}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Groupe live</span>
                  <select
                    value={assistantGroupName}
                    onChange={e => {
                      setAssistantGroupName(e.target.value);
                      setAssistantNamePrefix(e.target.value);
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400/50"
                  >
                    {DEFAULT_GROUPS.filter(group => group.name !== 'Master').map(group => (
                      <option key={group.name} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Nom</span>
                  <input
                    value={assistantNamePrefix}
                    onChange={e => setAssistantNamePrefix(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400/50"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/25 p-4 cursor-pointer hover:border-emerald-400/30 transition-all">
                <input
                  type="checkbox"
                  checked={assistantCreateShow}
                  onChange={e => setAssistantCreateShow(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-400"
                />
                <span>
                  <span className="block text-sm font-bold text-white">Créer aussi un mini show prêt à jouer</span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Ajoute 4 pads tactiles/MIDI non assignés: blanc, bleu, couleur et impact.
                  </span>
                </span>
              </label>

              {assistantCreateShow && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Type de show</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {Object.entries(ASSISTANT_SHOW_PROFILES).map(([id, profile]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAssistantShowProfile(id as AssistantShowProfileId)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          assistantShowProfile === id
                            ? 'bg-amber-500/10 border-amber-400/50'
                            : 'bg-black/25 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <p className="text-white text-xs font-bold">{profile.label}</p>
                        <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">{profile.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {assistantCreateShow && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Contrôle live</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(ASSISTANT_CONTROL_SURFACES).map(([id, surface]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setAssistantControlSurface(id as AssistantControlSurfaceId)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          assistantControlSurface === id
                            ? 'bg-cyan-500/10 border-cyan-400/50'
                            : 'bg-black/25 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <p className="text-white text-xs font-bold">{surface.label}</p>
                        <p className="text-slate-500 text-[10px] mt-1 leading-relaxed">{surface.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={runBeginnerAssistant}
                disabled={assistantSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-black transition-all"
              >
                <Wand2 className="w-4 h-4" />
                {assistantSaving ? 'Création du patch...' : 'Créer le patch automatiquement'}
              </button>
            </div>

            <div className="bg-black/25 border border-white/5 rounded-2xl p-5 space-y-4">
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">Prévisualisation</p>
              {(() => {
                const template = BEGINNER_FIXTURE_TEMPLATES[assistantTemplate];
                const start = findNextFreeAddress(template.channels.length, assistantUniverse);
                const end = start + template.channels.length * assistantCount - 1;
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                      <span className="text-slate-400">Lieu</span>
                      <span className="text-white font-bold">{ASSISTANT_VENUE_PROFILES[assistantVenueProfile].label}</span>
                    </div>
                    <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                      <span className="text-slate-400">Type</span>
                      <span className="text-white font-bold">{template.label}</span>
                    </div>
                    <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                      <span className="text-slate-400">Adresses</span>
                      <span className={end > 512 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        U{assistantUniverse} CH{start}-{end}
                      </span>
                    </div>
                    <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                      <span className="text-slate-400">Groupe</span>
                      <span className="text-white font-bold">{assistantGroupName}</span>
                    </div>
                    <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                      <span className="text-slate-400">Show prêt</span>
                      <span className={assistantCreateShow ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
                        {assistantCreateShow ? '4 pads tactiles' : 'Non'}
                      </span>
                    </div>
                    {assistantCreateShow && (
                      <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                        <span className="text-slate-400">Profil</span>
                        <span className="text-white font-bold">{ASSISTANT_SHOW_PROFILES[assistantShowProfile].label}</span>
                      </div>
                    )}
                    {assistantCreateShow && (
                      <div className="flex justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                        <span className="text-slate-400">Contrôle</span>
                        <span className="text-white font-bold">{ASSISTANT_CONTROL_SURFACES[assistantControlSurface].label}</span>
                      </div>
                    )}
                    <div className="border-t border-white/5 pt-4 space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pre-check show</p>
                      {readinessItems.map(item => {
                        const tone = item.ok && !item.warn
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20'
                          : item.ok || item.warn
                            ? 'text-amber-300 bg-amber-500/10 border-amber-400/20'
                            : 'text-red-400 bg-red-500/10 border-red-400/20';
                        return (
                          <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${tone}`}>
                                {item.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              </span>
                              <span className="text-white text-xs font-bold truncate">{item.label}</span>
                            </span>
                            <span className="text-slate-500 text-[10px] font-mono text-right truncate max-w-[150px]">{item.detail}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed border-t border-white/5 pt-4">
                      Après création, les faders SmartDashboard contrôleront ce groupe sans réglage DMX manuel. Si votre fixture réelle a un footprint différent, utilisez ensuite le scan IA de manuel.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : activeTab === 'scan' ? (
        <div className="flex-1 overflow-y-auto relative">
          <FixturesPage
            embedded={true}
            onSaved={(data) => {
              setPendingPatch(data);
              setPatchAddress(data.startAddress);
              setPatchUniverse(1);
            }}
          />

          {/* ── Panneau de confirmation "Patcher dans l'univers" ── */}
          {pendingPatch && (() => {
            const hasConflict = patchedFixtures.some(f =>
              f.universe === patchUniverse &&
              f.startAddress < patchAddress + pendingPatch.totalChannels &&
              f.startAddress + f.totalChannels > patchAddress
            );
            const conflictingFixture = patchedFixtures.find(f =>
              f.universe === patchUniverse &&
              f.startAddress < patchAddress + pendingPatch.totalChannels &&
              f.startAddress + f.totalChannels > patchAddress
            );
            return (
              <div className="sticky bottom-0 left-0 right-0 z-50 bg-[#0a0c10]/95 backdrop-blur-xl border-t-2 border-cyan-500/40 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] p-4 font-sans">
                <div className="flex items-start justify-between gap-4 max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{pendingPatch.name}</p>
                      <p className="text-slate-400 text-[11px]">{pendingPatch.totalChannels} canaux · sauvegardée ✓</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Patcher dans l'univers :</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Universe selector */}
                      <div className="flex gap-1">
                        {[1,2,3,4].map(u => (
                          <button
                            key={u}
                            onClick={() => setPatchUniverse(u)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                              patchUniverse === u
                                ? 'bg-cyan-500 text-black border-cyan-400'
                                : 'bg-black/40 text-slate-400 border-white/10 hover:border-cyan-500/40'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>

                      {/* Address input */}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Adresse DMX :</span>
                        <input
                          type="number"
                          min={1}
                          max={512 - pendingPatch.totalChannels + 1}
                          value={patchAddress}
                          onChange={e => setPatchAddress(Math.max(1, Math.min(512, parseInt(e.target.value) || 1)))}
                          className="w-16 bg-black/60 border border-white/20 rounded px-2 py-1 text-white text-sm font-mono text-center focus:outline-none focus:border-cyan-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const freeAddr = findNextFreeAddress(pendingPatch.totalChannels, patchUniverse);
                            setPatchAddress(freeAddr);
                            addToast({
                              type: 'info',
                              message: `Adresse libre : CH ${freeAddr}`,
                              detail: `Aucun conflit sur l'univers ${patchUniverse}.`,
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded text-[10px] font-bold font-sans transition-all"
                          title="Trouver automatiquement la première adresse libre"
                        >
                          <Wand2 className="w-3 h-3" />
                          Auto-Address
                        </button>
                        <span className="text-slate-600 text-[11px]">
                          → CH {patchAddress}–{patchAddress + pendingPatch.totalChannels - 1}
                        </span>
                      </div>

                      {/* Conflict warning */}
                      {hasConflict && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400 text-[10px]">
                          <AlertTriangle className="w-3 h-3" />
                          Conflit avec &quot;{conflictingFixture?.name}&quot;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPendingPatch(null)}
                      className="p-2 text-slate-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={confirmPatch}
                      disabled={hasConflict}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        hasConflict
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmer le patch
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden font-mono text-xs">

      {/* ── LEFT : Universe grids or Plan de feu 2D Canvas ──────── */}
      {activeTab === 'patch' ? (
        <div className="flex-1 flex flex-col overflow-hidden">

        {/* Universe tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/5 shrink-0">
          {[1, 2, 3, 4].map(u => (
            <button
              key={u}
              onClick={() => setActiveUniverse(u)}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                activeUniverse === u
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              Universe {u}
              {usedUniverses.includes(u) && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              )}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-slate-600 text-[10px]">
            {patchedFixtures.filter(f => f.universe === activeUniverse).length} fixture(s) · {' '}
            {patchedFixtures.filter(f => f.universe === activeUniverse)
              .reduce((acc, f) => acc + f.totalChannels, 0)} ch utilisés / 512
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <UniverseGrid
            universeNum={activeUniverse}
            fixtures={patchedFixtures}
            selectedId={selectedFixtureId}
            onSelect={handleSelect}
          />

          {/* Legend */}
          {patchedFixtures.filter(f => f.universe === activeUniverse).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {patchedFixtures.filter(f => f.universe === activeUniverse).map(f => {
                const isSelected = selectedFixtureIds.includes(f.nodeId) || selectedFixtureId === f.nodeId;
                return (
                  <button
                    key={f.nodeId}
                    onClick={(e) => handleSelect(f.nodeId, e)}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded border transition-all text-[10px] cursor-pointer ${
                      isSelected
                        ? 'border-white/30 bg-white/10'
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: f.color }} />
                    <span className="text-white font-semibold">{f.name}</span>
                    <span className="text-slate-500">
                      CH {f.startAddress}–{f.startAddress + f.totalChannels - 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {patchedFixtures.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Wand2 className="w-7 h-7 text-slate-600" />
              </div>
              <div>
                <p className="text-slate-400 font-sans font-semibold mb-1">Aucune fixture patchée</p>
                <p className="text-slate-600 font-sans text-[11px]">
                  Scannez un manuel ou glissez une fixture depuis le Canvas vers l'univers.
                </p>
              </div>
              <button
                onClick={() => router.push('/fixtures')}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors text-[11px] font-bold font-sans"
              >
                <Wand2 className="w-4 h-4" />
                SCAN FIXTURE IA
              </button>
            </div>
          )}
        </div>
      </div>
      ) : (
        <PlanDeFeuCanvas
          fixtures={patchedFixtures}
          nodes={nodes}
          onNodesChange={onNodesChange}
        />
      )}

      {/* ── RIGHT PANEL ──────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-l border-white/5 flex flex-col bg-[#0a0c10]">

        {/* Patched fixture list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Fixtures patchées
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">{patchedFixtures.length}</span>
              <button
                onClick={() => { setShowAddFromLib(v => !v); setAddLibSearch(''); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
                title="Ajouter une fixture depuis la bibliothèque"
              >
                <Plus className="w-3 h-3" />
                Ajouter
              </button>
            </div>
          </div>

          {/* ── Mini-formulaire ajout depuis bibliothèque ────────── */}
          {showAddFromLib && (
            <div className="border-b border-white/5 bg-[#0d0f14] p-3 flex flex-col gap-2 shrink-0">
              <input
                type="text"
                placeholder="Rechercher dans la bibliothèque…"
                value={addLibSearch}
                onChange={e => setAddLibSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 font-sans"
                autoFocus
              />
              <div className="max-h-32 overflow-y-auto flex flex-col divide-y divide-white/5">
                {libraryFixtures
                  .filter(f => f.name.toLowerCase().includes(addLibSearch.toLowerCase()))
                  .map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setPendingPatch({ id: f.id, name: f.name, totalChannels: f.total_channels, startAddress: f.start_address });
                        setPatchAddress(f.start_address);
                        setPatchUniverse(1);
                        setShowAddFromLib(false);
                        // scroll to bottom where confirmation panel appears
                      }}
                      className="flex items-center gap-2 px-2 py-2 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[10px] font-semibold truncate font-sans">{f.name}</p>
                        <p className="text-slate-600 text-[9px]">{f.total_channels}ch · @{f.start_address}</p>
                      </div>
                    </button>
                  ))}
                {libraryFixtures.filter(f => f.name.toLowerCase().includes(addLibSearch.toLowerCase())).length === 0 && (
                  <p className="text-slate-600 text-[10px] py-3 text-center font-sans">
                    Aucune fixture. Scannez d'abord.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Group assignment ─────────────────────────────── */}
          <div className="border-b border-white/5 bg-[#090b0f] p-3 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Groupes live
                </p>
                <p className="text-[9px] text-slate-600 font-sans">
                  Assigne la sélection aux faders/pads live.
                </p>
              </div>
              <span className="text-[9px] text-slate-600">
                {fixtureGroups.length}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {DEFAULT_GROUPS.map(group => {
                const saved = fixtureGroups.find(g => g.name.toLowerCase() === group.name.toLowerCase());
                const active = selectedGroupName === group.name;
                return (
                  <button
                    key={group.name}
                    type="button"
                    onClick={() => setSelectedGroupName(group.name)}
                    className={`px-2 py-1.5 rounded-lg border text-[9px] font-bold transition-all ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={saved ? `${saved.fixtureIds.length} fixture(s)` : 'Non configuré'}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.name}
                    {saved && <span className="ml-1 text-[8px] opacity-60">{saved.fixtureIds.length}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveSelectedGroup}
                disabled={groupSaving || selectedFixtureIds.length === 0}
                className="flex-1 px-2 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 disabled:bg-white/5 disabled:text-slate-600 disabled:border-white/5 text-cyan-400 border border-cyan-500/20 text-[9px] font-bold transition-all"
              >
                {groupSaving ? 'Sauvegarde...' : `Assigner ${selectedFixtureIds.length} sélection`}
              </button>
              <button
                type="button"
                onClick={selectGroupFixtures}
                disabled={!selectedGroup || selectedGroup.fixtureIds.length === 0}
                className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 border border-white/10 text-[9px] font-bold transition-all"
              >
                Voir
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {patchedFixtures.length === 0 ? (
              <p className="text-slate-600 text-[10px] text-center py-6 px-4 font-sans">
                Cliquez &quot;Ajouter&quot; ou allez dans SCAN IA.
              </p>
            ) : (
              patchedFixtures.map(f => {
                const isSelected = selectedFixtureIds.includes(f.nodeId) || selectedFixtureId === f.nodeId;
                const groupsForFixture = fixtureGroups.filter(group =>
                  f.fixtureId !== undefined && group.fixtureIds.includes(f.fixtureId)
                );
                return (
                  <div
                    key={f.nodeId}
                    className={`relative group px-4 py-3 transition-all cursor-pointer ${
                      isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                    }`}
                    onClick={(e) => {
                      handleSelect(f.nodeId, e);
                      setActiveUniverse(f.universe);
                    }}
                  >
                    {/* Bouton supprimer */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onNodesChange([{ id: f.nodeId, type: 'remove' }]);
                        if (selectedFixtureId === f.nodeId) handleSelect('');
                        addToast({ type: 'info', message: `${f.name} supprimée du patch` });
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded bg-red-500/10 hover:bg-red-500/30 text-red-400 transition-all cursor-pointer"
                      title="Supprimer du patch"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: f.color }} />
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-white font-bold text-[11px] truncate font-sans leading-tight">{f.name}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">{f.totalChannels} CH MODE</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Universe : <span className="text-slate-300">{f.universe}</span></span>
                      <span className="text-slate-500">
                        DMX : <span className="text-cyan-400">{f.startAddress}–{f.startAddress + f.totalChannels - 1}</span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {groupsForFixture.length === 0 ? (
                        <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-white/5 text-slate-600 border border-white/5">
                          Aucun groupe
                        </span>
                      ) : groupsForFixture.slice(0, 3).map(group => (
                        <span
                          key={group.id}
                          className="px-1 py-0.5 rounded text-[8px] font-bold border"
                          style={{
                            color: group.color,
                            borderColor: `${group.color}55`,
                            backgroundColor: `${group.color}18`,
                          }}
                        >
                          {group.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* ── LIVE DMX TEST ───────────────────────────────────── */}
        {selectedFixtureId && (() => {
          const sel = patchedFixtures.find(f => f.nodeId === selectedFixtureId);
          if (!sel) return null;
          const node = nodes.find(n => n.id === selectedFixtureId);
          const chDefs = ((node?.data?.channels as DmxChannelDefinition[]) || [])
            .filter(channel => Number.isFinite(Number(channel.channel)));

          const dimmerCh = findRelativeChannel(chDefs, ['dimmer', 'intensity', 'master']);
          const panCh = findRelativeChannel(chDefs, ['pan']);
          const tiltCh = findRelativeChannel(chDefs, ['tilt']);
          const strobeCh = findRelativeChannel(chDefs, ['strobe']);
          const shutterCh = findRelativeChannel(chDefs, ['shutter']);
          const redCh = findRelativeChannel(chDefs, ['red']);
          const greenCh = findRelativeChannel(chDefs, ['green']);
          const blueCh = findRelativeChannel(chDefs, ['blue']);
          const whiteCh = findRelativeChannel(chDefs, ['white']);
          const amberCh = findRelativeChannel(chDefs, ['amber']);
          const uvCh = findRelativeChannel(chDefs, ['uv']);
          const colorWheelCh = findRelativeChannel(chDefs, ['color wheel', 'colour wheel', 'color']);
          const goboCh = findRelativeChannel(chDefs, ['gobo']);
          const prismCh = findRelativeChannel(chDefs, ['prism']);
          const focusCh = findRelativeChannel(chDefs, ['focus']);
          const zoomCh = findRelativeChannel(chDefs, ['zoom']);

          const testChannels = [
            { label: 'Dimmer', ch: dimmerCh, color: '#facc15' },
            { label: 'Shutter', ch: shutterCh, color: '#f8fafc' },
            { label: 'Pan', ch: panCh, color: '#38bdf8' },
            { label: 'Tilt', ch: tiltCh, color: '#0ea5e9' },
            { label: 'Strobe', ch: strobeCh, color: '#fb923c' },
            { label: 'Color', ch: colorWheelCh, color: '#a855f7' },
            { label: 'Gobo', ch: goboCh, color: '#22c55e' },
            { label: 'Prism', ch: prismCh, color: '#ec4899' },
            { label: 'Focus', ch: focusCh, color: '#94a3b8' },
            { label: 'Zoom', ch: zoomCh, color: '#14b8a6' },
          ].filter(item => item.ch !== null);

          const keyFor = (relativeChannel: number) =>
            `${sel.nodeId}:${sel.universe}:${sel.startAddress + relativeChannel - 1}`;

          const getValue = (relativeChannel: number) => {
            const absoluteChannel = sel.startAddress + relativeChannel - 1;
            return quickDmxValues[keyFor(relativeChannel)] ??
              dmxEngine.getChannel(sel.universe, absoluteChannel);
          };

          const send = (relativeChannel: number | null, value: number) => {
            if (!relativeChannel) return false;
            const absoluteChannel = sel.startAddress + relativeChannel - 1;
            const safeValue = Math.max(0, Math.min(255, Math.round(value)));
            dmxEngine.setChannel(sel.universe, absoluteChannel, safeValue);
            setQuickDmxValues(prev => ({
              ...prev,
              [keyFor(relativeChannel)]: safeValue,
            }));
            return true;
          };

          const sendFallbackFullOn = () => {
            dmxEngine.setChannel(sel.universe, sel.startAddress, 255);
            setQuickDmxValues(prev => ({
              ...prev,
              [`${sel.nodeId}:${sel.universe}:${sel.startAddress}`]: 255,
            }));
          };

          const sendMany = (
            label: string,
            commands: Array<[number | null, number]>,
            fallback?: () => void,
          ) => {
            let sent = 0;
            commands.forEach(([channel, value]) => {
              if (send(channel, value)) sent += 1;
            });
            if (sent === 0 && fallback) {
              fallback();
              sent = 1;
            }
            addToast({
              type: socketReady ? 'success' : 'warning',
              message: label,
              detail: socketReady
                ? `${sent} canal(aux) DMX envoye(s) vers U${sel.universe}`
                : "Commande preparee, mais le backend DMX n'est pas connecte",
            });
          };

          const availableLabels = [
            dimmerCh && 'Dimmer',
            shutterCh && 'Shutter',
            redCh && 'RGB',
            colorWheelCh && 'Roue couleur',
            panCh && tiltCh && 'Pan/Tilt',
          ].filter(Boolean).join(' · ') || 'CH1 fallback';

          return (
            <div className="border-t-2 border-cyan-500/30 bg-[#0a0c10] shrink-0">
              <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> Test lumiere rapide / DMX
                  </span>
                  <p className="text-[9px] text-slate-500 truncate">
                    {sel.name} · {availableLabels}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[9px] text-slate-500 font-mono">
                    U{sel.universe} CH{sel.startAddress}-{sel.startAddress + sel.totalChannels - 1}
                  </span>
                  <span className={`text-[9px] font-black uppercase ${socketReady ? 'text-green-400' : 'text-amber-400'}`}>
                    {socketReady ? 'Backend DMX OK' : 'Backend offline'}
                  </span>
                </div>
              </div>

              <div className="px-4 py-3 flex flex-col gap-3 font-sans">
                <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-1.5 border border-white/5">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Adresse du projecteur</p>
                  <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Univ:</span>
                      <select
                        value={sel.universe}
                        onChange={(e) => {
                          const newU = parseInt(e.target.value, 10);
                          updateNodeData(sel.nodeId, { universe: newU });
                        }}
                        className="bg-black/60 border border-white/10 rounded px-1 py-0.5 text-white text-[10px] font-bold focus:outline-none focus:border-cyan-500/60"
                      >
                        {[1, 2, 3, 4].map(u => (
                          <option key={u} value={u}>Univ {u}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Adr:</span>
                      <input
                        type="number"
                        min={1}
                        max={512 - sel.totalChannels + 1}
                        value={sel.startAddress}
                        onChange={(e) => {
                          const maxAddress = Math.max(1, 512 - sel.totalChannels + 1);
                          const newAddr = Math.max(1, Math.min(maxAddress, parseInt(e.target.value, 10) || 1));
                          updateNodeData(sel.nodeId, { startAddress: newAddr });
                        }}
                        className="w-12 bg-black/60 border border-white/10 rounded px-1 py-0.5 text-center text-white text-[10px] font-bold focus:outline-none focus:border-cyan-500/60"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const freeAddr = findNextFreeAddress(sel.totalChannels, sel.universe, sel.nodeId);
                        updateNodeData(sel.nodeId, { startAddress: freeAddr });
                        addToast({
                          type: 'info',
                          message: `Fixture re-adressee : CH ${freeAddr}`,
                        });
                      }}
                      className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded text-[9px] font-bold font-sans transition-all"
                    >
                      Auto-address
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      sendMany('Test full on envoye', [
                        [dimmerCh, 255],
                        [shutterCh, 255],
                        [redCh, 255],
                        [greenCh, 255],
                        [blueCh, 255],
                        [whiteCh, 255],
                        [amberCh, 255],
                        [uvCh, 120],
                        [panCh, 127],
                        [tiltCh, 127],
                        [strobeCh, 0],
                      ], sendFallbackFullOn);
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded text-[10px] font-bold transition-all"
                  >
                    <Lightbulb className="w-3 h-3" /> Full on
                  </button>
                  <button
                    onClick={() => {
                      sendMany('Position centree', [
                        [panCh, 127],
                        [tiltCh, 127],
                      ]);
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded text-[10px] font-bold transition-all"
                  >
                    <Move className="w-3 h-3" /> Center
                  </button>
                  <button
                    onClick={() => {
                      sendMany('Couleur rouge envoyee', [
                        [dimmerCh, 255],
                        [shutterCh, 255],
                        [redCh, 255],
                        [greenCh, 0],
                        [blueCh, 0],
                        [whiteCh, 0],
                        [colorWheelCh, 15],
                      ]);
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded text-[10px] font-bold transition-all"
                  >
                    Rouge
                  </button>
                  <button
                    onClick={() => {
                      sendMany('Blackout fixture envoye', Array.from(
                        { length: sel.totalChannels },
                        (_, i) => [i + 1, 0] as [number, number],
                      ));
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[10px] font-bold transition-all"
                  >
                    <X className="w-3 h-3" /> Off
                  </button>
                </div>

                {testChannels.map(({ label, ch, color }) => {
                  const relativeChannel = ch as number;
                  const value = getValue(relativeChannel);
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 w-12 shrink-0 font-mono">{label}</span>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        value={value}
                        onChange={e => send(relativeChannel, parseInt(e.target.value, 10))}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      <span className="text-[9px] font-mono w-7 text-right" style={{ color }}>{value}</span>
                    </div>
                  );
                })}

                {chDefs.length === 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[10px] text-amber-200">
                    Profil de canaux non charge: Full on utilise CH{sel.startAddress} en secours. Charge le profil fixture pour obtenir les sliders Dimmer, RGB, Pan/Tilt et Strobe.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {false && selectedFixtureId && (() => {
          const sel = patchedFixtures.find(f => f.nodeId === selectedFixtureId)!;
          if (!sel) return null;
          const node = nodes.find(n => n.id === selectedFixtureId);
           
          const chDefs: any[] = (node?.data?.channels as any[]) || [];

          // Find key channels by type
          const findCh = (type: string) => chDefs.find(c => c.type === type)?.channel ?? null;
          const dimmerCh = findCh('dimmer');
          const panCh    = findCh('pan');
          const tiltCh   = findCh('tilt');
          const strobeCh = findCh('strobe');

          const send = (relCh: number, val: number) =>
            dmxEngine.setChannel(sel.universe, sel.startAddress + relCh - 1, val);

          return (
            <div className="border-t-2 border-cyan-500/30 bg-[#0a0c10] shrink-0">
              <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> LIVE TEST — {sel.name}
                </span>
                <span className="text-[9px] text-slate-600 font-mono">U{sel.universe} @{sel.startAddress}</span>
              </div>

              <div className="px-4 py-3 flex flex-col gap-3 font-sans">
                {/* Universe & Address Edit Form */}
                <div className="bg-white/5 p-2 rounded-lg flex flex-col gap-1.5 border border-white/5">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Configuration de l'adresse</p>
                  <div className="flex gap-2 items-center flex-wrap">
                    {/* Universe selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Univ:</span>
                      <select
                        value={sel.universe}
                        onChange={(e) => {
                          const newU = parseInt(e.target.value, 10);
                          updateNodeData(sel.nodeId, { universe: newU });
                        }}
                        className="bg-black/60 border border-white/10 rounded px-1 py-0.5 text-white text-[10px] font-bold focus:outline-none focus:border-cyan-500/60"
                      >
                        {[1, 2, 3, 4].map(u => (
                          <option key={u} value={u}>Univ {u}</option>
                        ))}
                      </select>
                    </div>

                    {/* Address Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Adr:</span>
                      <input
                        type="number"
                        min={1}
                        max={512 - sel.totalChannels + 1}
                        value={sel.startAddress}
                        onChange={(e) => {
                          const newAddr = Math.max(1, Math.min(512, parseInt(e.target.value) || 1));
                          updateNodeData(sel.nodeId, { startAddress: newAddr });
                        }}
                        className="w-12 bg-black/60 border border-white/10 rounded px-1 py-0.5 text-center text-white text-[10px] font-bold focus:outline-none focus:border-cyan-500/60"
                      />
                    </div>

                    {/* Auto-readdress button */}
                    <button
                      type="button"
                      onClick={() => {
                        const freeAddr = findNextFreeAddress(sel.totalChannels, sel.universe, sel.nodeId);
                        updateNodeData(sel.nodeId, { startAddress: freeAddr });
                        addToast({
                          type: 'info',
                          message: `Fixture ré-adressée : CH ${freeAddr}`,
                        });
                      }}
                      className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded text-[9px] font-bold font-sans transition-all"
                      title="Trouver automatiquement une adresse libre dans cet univers"
                    >
                      Auto-Address
                    </button>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (dimmerCh) send(dimmerCh, 255);
                      if (panCh) send(panCh, 127);
                      if (tiltCh) send(tiltCh, 127);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded text-[10px] font-bold transition-all"
                  >
                    <Lightbulb className="w-3 h-3" /> FULL ON
                  </button>
                  <button
                    onClick={() => {
                      if (panCh) send(panCh, 127);
                      if (tiltCh) send(tiltCh, 127);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded text-[10px] font-bold transition-all"
                  >
                    <Move className="w-3 h-3" /> CENTER
                  </button>
                  <button
                    onClick={() => {
                      for (let i = 1; i <= sel.totalChannels; i++) send(i, 0);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[10px] font-bold transition-all"
                  >
                    <X className="w-3 h-3" /> OFF
                  </button>
                </div>

                {/* Key sliders */}
                {[
                  { label: 'Dimmer', ch: dimmerCh, color: '#facc15' },
                  { label: 'Pan',    ch: panCh,    color: '#38bdf8' },
                  { label: 'Tilt',   ch: tiltCh,   color: '#0ea5e9' },
                  { label: 'Strobe', ch: strobeCh,  color: '#fb923c' },
                ].filter(s => s.ch !== null).map(({ label, ch, color }) => {
                  const absVal = dmxEngine.getChannel(sel.universe, sel.startAddress + (ch as number) - 1);
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 w-10 shrink-0 font-mono">{label}</span>
                      <input
                        type="range" min={0} max={255}
                        defaultValue={absVal}
                        onChange={e => send(ch as number, parseInt(e.target.value))}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      <span className="text-[9px] font-mono w-7 text-right" style={{ color }}>{absVal}</span>
                    </div>
                  );
                })}

                {/* If no channel defs, show generic dimmer for CH1 */}
                {chDefs.length === 0 && (
                  <p className="text-slate-600 text-[10px] font-sans text-center">
                    Channels non chargés — ouvre le nœud sur le Canvas pour les charger.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Fixture Library ─────────────────────────────────── */}
        <div className="h-[240px] border-t border-white/5 flex flex-col shrink-0">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Fixture Library
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfileBuilder(true)}
                className="fixture-profile-import-entry flex items-center gap-1 text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors font-bold"
              >
                <Plus className="w-3 h-3" />
                Nouveau
              </button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => setActiveTab('scan')}
                className="fixture-profile-scan-entry flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 transition-colors font-bold"
              >
                <Plus className="w-3 h-3" />
                SCAN IA
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-white/5 shrink-0">
            <input
              type="text"
              placeholder="Search Fixtures…"
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 font-sans"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredLibrary.length === 0 ? (
              <p className="text-slate-600 text-[10px] text-center py-4 font-sans px-3">
                {libraryFixtures.length === 0
                  ? 'Aucune fixture. Cliquez SCAN IA →'
                  : 'Aucun résultat.'}
              </p>
            ) : (
              filteredLibrary.map(f => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/[0.03] cursor-pointer group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[10px] font-semibold truncate font-sans leading-tight">
                      {f.name}
                    </p>
                    <p className="text-slate-600 text-[9px]">
                      {f.manufacturer ?? 'Generic'} · {f.total_channels}ch · @{f.start_address}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
      )}
      {showProfileBuilder && (
        <FixtureProfileBuilder
          onClose={() => setShowProfileBuilder(false)}
          onSuccess={() => {
            addToast({
              type: 'success',
              message: 'Projecteur enregistré avec succès !',
            });
            loadLibraryFixtures();
          }}
        />
      )}
    </div>
  );
}

// ─── PlanDeFeuCanvas: 2D Spatial Placement & Alignment ───────────
interface PlanDeFeuCanvasProps {
  fixtures: PatchedFixture[];
  nodes: any[];
  onNodesChange: any;
}

function PlanDeFeuCanvas({
  fixtures,
  nodes,
  onNodesChange,
}: PlanDeFeuCanvasProps) {
  const {
    selectedFixtureId,
    setSelectedFixtureId,
    selectedFixtureIds,
    setSelectedFixtureIds,
    setIsBottomPanelVisible
  } = useStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [nodeStartPos, setNodeStartPos] = React.useState({ x: 0, y: 0 });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBottomPanelVisible(true);
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selectedFixtureIds.includes(id)) {
        const next = selectedFixtureIds.filter(x => x !== id);
        setSelectedFixtureIds(next);
        if (selectedFixtureId === id) {
          setSelectedFixtureId(next[0] || null);
        }
      } else {
        const next = [...selectedFixtureIds, id];
        setSelectedFixtureIds(next);
        setSelectedFixtureId(id);
      }
    } else {
      setSelectedFixtureId(id);
      setSelectedFixtureIds([id]);
    }
  };

  const selectAll = () => {
    const allIds = fixtures.map(f => f.nodeId);
    setSelectedFixtureIds(allIds);
    if (allIds.length > 0 && !allIds.includes(selectedFixtureId || "")) {
      setSelectedFixtureId(allIds[0]);
    }
  };

  const deselectAll = () => {
    setSelectedFixtureIds([]);
    setSelectedFixtureId(null);
  };

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setNodeStartPos({ x: node.position.x, y: node.position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    onNodesChange([
      {
        id: draggingId,
        type: 'position',
        position: {
          x: Math.round((nodeStartPos.x + dx) / 10) * 10,
          y: Math.round((nodeStartPos.y + dy) / 10) * 10
        }
      }
    ]);
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const alignHorizontally = () => {
    if (selectedFixtureIds.length < 2) return;
    const selectedNodes = nodes.filter(n => selectedFixtureIds.includes(n.id));
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

    onNodesChange(
      selectedNodes.map(n => ({
        id: n.id,
        type: 'position',
        position: { x: n.position.x, y: Math.round(avgY) }
      }))
    );
  };

  const alignVertically = () => {
    if (selectedFixtureIds.length < 2) return;
    const selectedNodes = nodes.filter(n => selectedFixtureIds.includes(n.id));
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;

    onNodesChange(
      selectedNodes.map(n => ({
        id: n.id,
        type: 'position',
        position: { x: Math.round(avgX), y: n.position.y }
      }))
    );
  };

  const distributeHorizontally = () => {
    if (selectedFixtureIds.length < 3) return;
    const selectedNodes = [...nodes.filter(n => selectedFixtureIds.includes(n.id))].sort(
      (a, b) => a.position.x - b.position.x
    );
    const minX = selectedNodes[0].position.x;
    const maxX = selectedNodes[selectedNodes.length - 1].position.x;
    const step = (maxX - minX) / (selectedNodes.length - 1);

    onNodesChange(
      selectedNodes.map((n, idx) => ({
        id: n.id,
        type: 'position',
        position: { x: Math.round(minX + idx * step), y: n.position.y }
      }))
    );
  };

  const distributeVertically = () => {
    if (selectedFixtureIds.length < 3) return;
    const selectedNodes = [...nodes.filter(n => selectedFixtureIds.includes(n.id))].sort(
      (a, b) => a.position.y - b.position.y
    );
    const minY = selectedNodes[0].position.y;
    const maxY = selectedNodes[selectedNodes.length - 1].position.y;
    const step = (maxY - minY) / (selectedNodes.length - 1);

    onNodesChange(
      selectedNodes.map((n, idx) => ({
        id: n.id,
        type: 'position',
        position: { x: n.position.x, y: Math.round(minY + idx * step) }
      }))
    );
  };

  const autoPositionGrid = () => {
    const targetIds = selectedFixtureIds.length > 0 ? selectedFixtureIds : fixtures.map(f => f.nodeId);
    if (targetIds.length === 0) return;

    const selectedNodes = nodes.filter(n => targetIds.includes(n.id));
    const startX = 100;
    const startY = 100;
    const spacingX = 140;
    const spacingY = 120;
    const cols = 3;

    onNodesChange(
      selectedNodes.map((n, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        return {
          id: n.id,
          type: 'position',
          position: {
            x: startX + col * spacingX,
            y: startY + row * spacingY
          }
        };
      })
    );
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="flex-1 flex flex-col overflow-hidden bg-[#080a0e] select-none"
    >
      {/* Plan de feu toolbar */}
      <div className="px-4 py-2 bg-[#0c0f14] border-b border-white/5 flex flex-wrap gap-2 items-center justify-between shrink-0 font-sans">
        <div className="flex gap-1">
          <button
            onClick={alignHorizontally}
            disabled={selectedFixtureIds.length < 2}
            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
          >
            Aligner H
          </button>
          <button
            onClick={alignVertically}
            disabled={selectedFixtureIds.length < 2}
            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
          >
            Aligner V
          </button>
          <button
            onClick={distributeHorizontally}
            disabled={selectedFixtureIds.length < 3}
            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
          >
            Répartir H
          </button>
          <button
            onClick={distributeVertically}
            disabled={selectedFixtureIds.length < 3}
            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
          >
            Répartir V
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={selectAll}
            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[9px]"
          >
            Tout sél.
          </button>
          <button
            onClick={deselectAll}
            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[9px]"
          >
            Désél.
          </button>
          <button
            onClick={autoPositionGrid}
            className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-[9px] font-bold"
          >
            Positions auto
          </button>
        </div>
      </div>

      {/* Grid workspace */}
      <div 
        className="flex-1 relative overflow-hidden bg-black/40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      >
        {/* Labels CONTRE / FACE */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">
          Contre / Haut
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">
          Face / Bas
        </div>

        {/* Fixtures Nodes mapping */}
        {fixtures.map((f) => {
          const node = nodes.find(n => n.id === f.nodeId);
          if (!node) return null;

          const isSelected = selectedFixtureIds.includes(f.nodeId);
          const x = node.position.x;
          const y = node.position.y;

          return (
            <div
              key={f.nodeId}
              onMouseDown={(e) => handleMouseDown(f.nodeId, e)}
              onClick={(e) => toggleSelect(f.nodeId, e)}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
                cursor: draggingId === f.nodeId ? "grabbing" : "grab"
              }}
              className={`w-28 bg-[#111318]/90 border rounded-2xl p-2 text-center transition-all ${
                isSelected
                  ? "border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.25)] bg-cyan-950/20"
                  : "border-white/5 hover:border-white/10"
              }`}
            >
              {/* Bulb/Fixture icon representation */}
              <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center mx-auto mb-1">
                <div 
                  className="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ color: f.color }}
                />
              </div>

              <p className="text-[9px] font-bold text-white truncate leading-tight font-sans">
                {f.name}
              </p>
              <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                U{f.universe} CH{f.startAddress}
              </p>
            </div>
          );
        })}

        {fixtures.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-[10px] font-sans">
            Aucune fixture à afficher. Patchez d'abord des projecteurs.
          </div>
        )}
      </div>
    </div>
  );
}
