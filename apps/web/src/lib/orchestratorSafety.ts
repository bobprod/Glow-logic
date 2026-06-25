/**
 * orchestratorSafety — couche de VALIDATION pure pour les actions DMX issues de l'IA
 * (OrchestratorController). Aucune dépendance store/DOM/socket : fonctions déterministes,
 * défensives, testables en isolation.
 *
 * Invariant : les actions SÛRES (bornes valides, canal non dangereux ou dangereux+armé)
 * passent comme avant ; seules les actions hors bornes ou dangereuses non armées sont bloquées.
 * L'IA ne peut PAS armer/désarmer la sécurité : ce module ne lit que `dangerousArmed`, jamais ne le modifie.
 */

/** Une commande DMX atomique proposée par l'IA. */
export interface OrchestratorAction {
  /** Univers DMX (>=1). */
  universe: number;
  /** Canal DMX 1..512. */
  channel: number;
  /** Valeur 0..255 (sera bornée). */
  value: number;
}

/** Contexte safety côté client au moment de la validation. */
export interface SafetyContext {
  /** Canaux considérés dangereux (laser/pyro/...). Set ou tableau de numéros de canal. */
  dangerousChannels: Set<number> | number[];
  /** true si les sorties dangereuses sont armées par l'opérateur (humain, jamais l'IA). */
  dangerousArmed: boolean;
}

/** Résultat de validation d'une action unique. */
export interface ValidationResult {
  /** true si l'action peut être exécutée (éventuellement après clamp). */
  allowed: boolean;
  /** Raison du refus si allowed=false (message clair, lisible). */
  reason?: string;
  /** Valeur effectivement applicable, bornée 0..255 (présente si allowed=true). */
  clampedValue?: number;
}

const CHANNEL_MIN = 1;
const CHANNEL_MAX = 512;
const VALUE_MIN = 0;
const VALUE_MAX = 255;
const UNIVERSE_MIN = 1;

/** Borne un nombre entier dans [min, max]. Valeurs non finies => min. */
function clampInt(n: number, min: number, max: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return min;
  const r = Math.round(n);
  if (r < min) return min;
  if (r > max) return max;
  return r;
}

/** true si `channel` figure dans la liste des canaux dangereux du contexte. */
function isDangerousChannel(channel: number, dangerousChannels: Set<number> | number[]): boolean {
  if (!dangerousChannels) return false;
  if (dangerousChannels instanceof Set) return dangerousChannels.has(channel);
  if (Array.isArray(dangerousChannels)) return dangerousChannels.includes(channel);
  return false;
}

/**
 * Valide une action DMX contre le contexte safety.
 * - universe doit être un entier >= 1.
 * - channel doit être un entier dans 1..512.
 * - value est bornée 0..255 (clampedValue).
 * - canal dangereux ET !dangerousArmed => refusé ("canal dangereux non armé").
 */
export function validateOrchestratorAction(
  action: OrchestratorAction,
  ctx: SafetyContext,
): ValidationResult {
  if (!action || typeof action !== 'object') {
    return { allowed: false, reason: 'action invalide (objet manquant)' };
  }

  const { universe, channel } = action;

  if (typeof universe !== 'number' || !Number.isFinite(universe) || Math.round(universe) < UNIVERSE_MIN) {
    return { allowed: false, reason: `univers hors borne (>=${UNIVERSE_MIN}) : ${universe}` };
  }

  if (
    typeof channel !== 'number' ||
    !Number.isFinite(channel) ||
    Math.round(channel) < CHANNEL_MIN ||
    Math.round(channel) > CHANNEL_MAX
  ) {
    return { allowed: false, reason: `canal hors borne (${CHANNEL_MIN}..${CHANNEL_MAX}) : ${channel}` };
  }

  const normChannel = Math.round(channel);

  if (isDangerousChannel(normChannel, ctx?.dangerousChannels) && !ctx?.dangerousArmed) {
    return { allowed: false, reason: 'canal dangereux non armé' };
  }

  const clampedValue = clampInt(action.value, VALUE_MIN, VALUE_MAX);
  return { allowed: true, clampedValue };
}

/**
 * Valide/filtre une liste d'actions.
 * Retourne `applied` (actions autorisées, value remplacée par la valeur bornée) et
 * `blocked` (actions refusées avec leur raison).
 */
export function validateOrchestratorActions(
  actions: OrchestratorAction[],
  ctx: SafetyContext,
): { applied: OrchestratorAction[]; blocked: Array<{ action: OrchestratorAction; reason: string }> } {
  const applied: OrchestratorAction[] = [];
  const blocked: Array<{ action: OrchestratorAction; reason: string }> = [];

  if (!Array.isArray(actions)) {
    return { applied, blocked };
  }

  for (const action of actions) {
    const result = validateOrchestratorAction(action, ctx);
    if (result.allowed) {
      applied.push({
        universe: Math.round(action.universe),
        channel: Math.round(action.channel),
        value: result.clampedValue ?? VALUE_MIN,
      });
    } else {
      blocked.push({ action, reason: result.reason ?? 'action refusée' });
    }
  }

  return { applied, blocked };
}
