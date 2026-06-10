import { getSetting, setSetting } from "./database";
import { addSupportLog } from "./supportLog";

export type OperatorRole = "beginner" | "expert" | "admin";
export type HazardType = "laser" | "pyro" | "drone" | "external_api";
export type OutputMode = "simulation" | "physical";

export interface SafetyState {
  operatorRole: OperatorRole;
  dangerousPhysicalOutputsEnabled: boolean;
  armed: Record<HazardType, boolean>;
  rules: Array<{
    id: string;
    label: string;
    active: boolean;
  }>;
}

export interface SafetyValidationInput {
  hazard?: HazardType;
  outputMode?: OutputMode;
  source?: "manual" | "midi" | "ai" | "api" | "timeline";
  description?: string;
  payload?: Record<string, unknown>;
}

export interface SafetyValidationResult {
  allowed: boolean;
  reason: string;
  requiresManualArm: boolean;
  state: SafetyState;
}

const HAZARDS: HazardType[] = ["laser", "pyro", "drone", "external_api"];
const LASER_MAX_POWER = 64;
const DRONE_GEOFENCE = {
  minX: -20,
  maxX: 20,
  minY: 0,
  maxY: 12,
  minZ: -20,
  maxZ: 20,
};

function readRole(): OperatorRole {
  const role = getSetting("safety_operator_role");
  return role === "expert" || role === "admin" ? role : "beginner";
}

function readArmed(hazard: HazardType) {
  return getSetting(`safety_armed_${hazard}`) === "true";
}

export function getSafetyState(): SafetyState {
  const operatorRole = readRole();
  const armed = Object.fromEntries(HAZARDS.map((hazard) => [hazard, readArmed(hazard)])) as Record<HazardType, boolean>;

  return {
    operatorRole,
    dangerousPhysicalOutputsEnabled: false,
    armed,
    rules: [
      {
        id: "ai-cannot-arm",
        label: "IA et API externes ne peuvent jamais armer une fonction dangereuse.",
        active: true,
      },
      {
        id: "physical-danger-blocked",
        label: "Lasers, pyro et drones restent bloques en sortie physique dans le MVP.",
        active: true,
      },
      {
        id: "beginner-safe-mode",
        label: "Le role debutant bloque les fonctions sensibles et garde seulement DMX/media standards.",
        active: operatorRole === "beginner",
      },
      {
        id: "laser-power-limit",
        label: `Puissance laser bornee en dur a ${LASER_MAX_POWER}/255 avant toute sortie physique.`,
        active: true,
      },
      {
        id: "drone-geofence",
        label: `Trajectoires drones limitees a X/Z +/-20m et Y 0-12m en simulation.`,
        active: true,
      },
    ],
  };
}

function readNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLaserPower(payload?: Record<string, unknown>): number | null {
  if (!payload) return null;
  return readNumber(payload.power ?? payload.laserPower ?? payload.grandMaster ?? payload.value);
}

function getDronePoints(payload?: Record<string, unknown>): Array<{ x: number; y: number; z: number }> {
  if (!payload) return [];
  const rawPoints = Array.isArray(payload.trajectory)
    ? payload.trajectory
    : Array.isArray(payload.points)
      ? payload.points
      : payload.position
        ? [payload.position]
        : [];

  return rawPoints.flatMap((point) => {
    if (!point || typeof point !== "object") return [];
    const record = point as Record<string, unknown>;
    const x = readNumber(record.x);
    const y = readNumber(record.y);
    const z = readNumber(record.z);
    if (x === null || y === null || z === null) return [];
    return [{ x, y, z }];
  });
}

function isInsideDroneGeofence(point: { x: number; y: number; z: number }) {
  return point.x >= DRONE_GEOFENCE.minX
    && point.x <= DRONE_GEOFENCE.maxX
    && point.y >= DRONE_GEOFENCE.minY
    && point.y <= DRONE_GEOFENCE.maxY
    && point.z >= DRONE_GEOFENCE.minZ
    && point.z <= DRONE_GEOFENCE.maxZ;
}

export function setOperatorRole(role: OperatorRole) {
  setSetting("safety_operator_role", role);
  addSupportLog("SAFETY", `Operator role set to ${role}`, "warning", { role });
  return getSafetyState();
}

export function setHazardArmed(hazard: HazardType, armed: boolean, confirmation?: string) {
  if (!HAZARDS.includes(hazard)) {
    throw new Error("Hazard inconnu");
  }

  const state = getSafetyState();
  if (state.operatorRole === "beginner") {
    addSupportLog("SAFETY", `Arm refused for ${hazard}: beginner role`, "warning");
    throw new Error("Le role debutant ne peut pas armer une fonction dangereuse");
  }

  if (armed && confirmation !== `ARM ${hazard.toUpperCase()}`) {
    addSupportLog("SAFETY", `Arm refused for ${hazard}: missing confirmation`, "warning");
    throw new Error(`Confirmation requise: ARM ${hazard.toUpperCase()}`);
  }

  setSetting(`safety_armed_${hazard}`, String(armed));
  addSupportLog("SAFETY", `${hazard} ${armed ? "armed" : "disarmed"} manually`, armed ? "warning" : "info", {
    hazard,
    operatorRole: state.operatorRole,
  });
  return getSafetyState();
}

export function validateSafetyAction(input: SafetyValidationInput): SafetyValidationResult {
  const state = getSafetyState();
  const hazard = input.hazard;
  const outputMode = input.outputMode || "simulation";
  const source = input.source || "manual";

  if (!hazard) {
    return {
      allowed: true,
      reason: "Action standard autorisee",
      requiresManualArm: false,
      state,
    };
  }

  if (hazard === "laser") {
    const power = getLaserPower(input.payload);
    if (power !== null && power > LASER_MAX_POWER) {
      addSupportLog("SAFETY", `Blocked laser power ${power}: hard limit ${LASER_MAX_POWER}`, "warning", input as Record<string, unknown>);
      return {
        allowed: false,
        reason: `Puissance laser ${power}/255 au-dessus de la limite deterministe ${LASER_MAX_POWER}/255`,
        requiresManualArm: true,
        state,
      };
    }
  }

  if (hazard === "drone") {
    const points = getDronePoints(input.payload);
    const outside = points.find((point) => !isInsideDroneGeofence(point));
    if (outside) {
      addSupportLog("SAFETY", "Blocked drone trajectory outside geofence", "warning", {
        ...input,
        outside,
        geofence: DRONE_GEOFENCE,
      } as Record<string, unknown>);
      return {
        allowed: false,
        reason: "Trajectoire drone hors geofence deterministe",
        requiresManualArm: true,
        state,
      };
    }
  }

  if (source === "ai" || source === "api") {
    addSupportLog("SAFETY", `Blocked ${hazard} from ${source}`, "warning", input as Record<string, unknown>);
    return {
      allowed: false,
      reason: "L'IA et les API externes ne peuvent pas declencher une fonction dangereuse sans validation manuelle",
      requiresManualArm: true,
      state,
    };
  }

  if (state.operatorRole === "beginner") {
    addSupportLog("SAFETY", `Blocked ${hazard}: beginner role`, "warning", input as Record<string, unknown>);
    return {
      allowed: false,
      reason: "Fonction bloquee en role debutant",
      requiresManualArm: true,
      state,
    };
  }

  if (outputMode === "physical" && !state.dangerousPhysicalOutputsEnabled) {
    addSupportLog("SAFETY", `Blocked physical ${hazard}: MVP physical dangerous output disabled`, "warning", input as Record<string, unknown>);
    return {
      allowed: false,
      reason: "Sortie physique dangereuse desactivee dans le MVP",
      requiresManualArm: true,
      state,
    };
  }

  if (!state.armed[hazard]) {
    return {
      allowed: false,
      reason: `${hazard} non arme manuellement`,
      requiresManualArm: true,
      state,
    };
  }

  addSupportLog("SAFETY", `Allowed simulated ${hazard}`, "warning", input as Record<string, unknown>);
  return {
    allowed: true,
    reason: "Action autorisee par Safety Gate",
    requiresManualArm: false,
    state,
  };
}
