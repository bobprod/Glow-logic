// ─────────────────────────────────────────────────────────────────────────
// fixtureCategoryIcon.tsx — Couche UI de la taxonomie d'équipements.
//
// fixtureCategories.ts est PUR (aucune dépendance navigateur / React) et ne
// stocke qu'un *nom* d'icône lucide en chaîne. Ce module résout ce nom en un
// vrai composant lucide-react, en mappant chaque FixtureCategoryId vers une
// icône VÉRIFIÉE comme exportée par lucide-react. Tout id inconnu retombe sur
// l'icône `Box` (repli sûr).
//
// Il fournit aussi `safetyBadge()` pour styliser le badge de sécurité (effet
// ambre / danger rouge) affiché à côté du nom des projecteurs.
// ─────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  Lightbulb,
  Sun,
  Flashlight,
  ScanLine,
  AlignJustify,
  Zap,
  SunMedium,
  Moon,
  Lamp,
  CircleDot,
  Crosshair,
  Cloud,
  CloudFog,
  Sparkles,
  Fan,
  Flame,
  MonitorPlay,
  Box,
  type LucideIcon,
} from "lucide-react";
import type { FixtureCategoryId, SafetyClass } from "./fixtureCategories";

// Mappe chaque famille vers un composant lucide RÉEL (tous vérifiés présents
// dans lucide-react). `lyre_beam` utilise `Flashlight` (le `FlashlightOff`
// suggéré existe aussi mais évoque un projecteur éteint — moins parlant).
const CATEGORY_ICONS: Record<FixtureCategoryId, LucideIcon> = {
  lyre_spot: Lightbulb,
  lyre_wash: Sun,
  lyre_beam: Flashlight,
  scanner: ScanLine,
  par_led: Lightbulb,
  led_bar: AlignJustify,
  strobe: Zap,
  blinder: SunMedium,
  uv: Moon,
  conventional: Lamp,
  gobo_projector: CircleDot,
  laser: Crosshair,
  smoke: Cloud,
  hazer: CloudFog,
  co2: Sparkles,
  fan: Fan,
  pyro: Flame,
  video: MonitorPlay,
  generic: Box,
};

export function CategoryIcon({
  categoryId,
  className,
}: {
  categoryId: FixtureCategoryId;
  className?: string;
}): React.ReactElement {
  const Icon = CATEGORY_ICONS[categoryId] ?? Box;
  return <Icon className={className} aria-hidden="true" />;
}

// Style du badge de sécurité. `normal` ⇒ null (aucun badge affiché).
export interface SafetyBadge {
  label: string;
  // Classes Tailwind prêtes à l'emploi (cohérentes avec la palette slate/amber/red).
  className: string;
}

export function safetyBadge(safety: SafetyClass): SafetyBadge | null {
  switch (safety) {
    case "effect":
      return {
        label: "Effet",
        className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
      };
    case "hazard":
      return {
        label: "Danger",
        className: "border-red-500/50 bg-red-500/15 text-red-300",
      };
    case "normal":
    default:
      return null;
  }
}
