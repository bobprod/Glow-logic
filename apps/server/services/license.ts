import crypto from "crypto";
import os from "os";
import { getSetting, setSetting } from "./database";
import { addSupportLog } from "./supportLog";

const TRIAL_DAYS = 30;
const SIGNING_SALT = "glow-logic-local-license-v1";

export type LicenseMode = "trial" | "activated" | "expired" | "invalid";

export interface LicenseStatus {
  mode: LicenseMode;
  offlineReady: boolean;
  machineId: string;
  licenseName: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  message: string;
}

type LicensePayload = {
  product: "glow-logic";
  licenseName: string;
  machineId: string;
  expiresAt?: string | null;
  signature: string;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getMachineId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.userInfo().username,
  ].join("|");
  return sha256(raw).slice(0, 16).toUpperCase();
}

function expectedSignature(payload: Omit<LicensePayload, "signature">) {
  return sha256([
    payload.product,
    payload.licenseName,
    payload.machineId,
    payload.expiresAt || "never",
    SIGNING_SALT,
  ].join("|"));
}

function decodeLicenseKey(key: string): LicensePayload | null {
  try {
    const normalized = key.trim().replace(/^GL-/i, "");
    const json = Buffer.from(normalized, "base64url").toString("utf8");
    return JSON.parse(json) as LicensePayload;
  } catch {
    return null;
  }
}

function trialStatus(machineId: string): LicenseStatus {
  let firstRun = getSetting("license_first_run_at");
  if (!firstRun) {
    firstRun = new Date().toISOString();
    setSetting("license_first_run_at", firstRun);
  }

  const firstRunMs = new Date(firstRun).getTime();
  const expiresMs = firstRunMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
  const expired = Date.now() > expiresMs;

  return {
    mode: expired ? "expired" : "trial",
    offlineReady: true,
    machineId,
    licenseName: null,
    expiresAt: new Date(expiresMs).toISOString(),
    daysRemaining,
    message: expired
      ? "Période d'essai expirée. Activation locale requise."
      : `Mode essai local actif (${daysRemaining} jours restants).`,
  };
}

export function getLicenseStatus(): LicenseStatus {
  const machineId = getMachineId();
  const key = getSetting("license_key");
  if (!key) return trialStatus(machineId);

  const payload = decodeLicenseKey(key);
  if (!payload || payload.product !== "glow-logic") {
    return { ...trialStatus(machineId), mode: "invalid", message: "Licence locale illisible." };
  }

  const { signature, ...unsigned } = payload;
  const validSignature = signature === expectedSignature(unsigned);
  const validMachine = payload.machineId === machineId || payload.machineId === "ANY";
  const expiresMs = payload.expiresAt ? new Date(payload.expiresAt).getTime() : null;
  const expired = expiresMs !== null && Date.now() > expiresMs;

  if (!validSignature || !validMachine) {
    return { ...trialStatus(machineId), mode: "invalid", message: "Licence locale invalide pour cette machine." };
  }

  return {
    mode: expired ? "expired" : "activated",
    offlineReady: true,
    machineId,
    licenseName: payload.licenseName,
    expiresAt: payload.expiresAt || null,
    daysRemaining: expiresMs === null ? null : Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000))),
    message: expired ? "Licence expirée." : "Licence locale activée. Glow Logic fonctionne hors ligne.",
  };
}

export function activateLicense(key: string): LicenseStatus {
  const payload = decodeLicenseKey(key);
  if (!payload) throw new Error("Clé de licence illisible");

  setSetting("license_key", key.trim());
  const status = getLicenseStatus();
  if (status.mode !== "activated") {
    throw new Error(status.message);
  }

  addSupportLog("LICENSE", `Licence activée: ${status.licenseName}`, "info", {
    machineId: status.machineId,
    expiresAt: status.expiresAt,
  });
  return status;
}

export function createLocalLicenseKey(licenseName: string, machineId = getMachineId(), expiresAt?: string | null) {
  const unsigned: Omit<LicensePayload, "signature"> = {
    product: "glow-logic",
    licenseName,
    machineId,
    expiresAt: expiresAt || null,
  };
  const payload: LicensePayload = {
    ...unsigned,
    signature: expectedSignature(unsigned),
  };
  return `GL-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}
