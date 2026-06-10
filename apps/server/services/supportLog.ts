import fs from "fs";
import os from "os";
import path from "path";

export type SupportSeverity = "info" | "warning" | "error";

export interface SupportLogEntry {
  timestamp: string;
  source: string;
  message: string;
  severity: SupportSeverity;
  context?: Record<string, unknown>;
}

const MAX_ENTRIES = 300;
const entries: SupportLogEntry[] = [];
const LOG_DIR = path.join(os.homedir(), "AppData", "Local", "GlowLogic", "logs");
const LOG_FILE = path.join(LOG_DIR, "support.log");

function sanitizeContext(context?: Record<string, unknown>) {
  if (!context) return undefined;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token")) {
        return [key, "[masked]"];
      }
      return [key, value];
    }),
  );
}

function appendToFile(entry: SupportLogEntry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Support logging must never affect live DMX output.
  }
}

export function addSupportLog(
  source: string,
  message: string,
  severity: SupportSeverity = "info",
  context?: Record<string, unknown>,
) {
  const entry: SupportLogEntry = {
    timestamp: new Date().toISOString(),
    source,
    message,
    severity,
    context: sanitizeContext(context),
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.pop();
  appendToFile(entry);
}

export function getSupportLogs(limit = 100): SupportLogEntry[] {
  return entries.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

export function clearSupportLogs() {
  entries.length = 0;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, "", "utf8");
  } catch {}
}

export function getSupportLogPath() {
  return LOG_FILE;
}
