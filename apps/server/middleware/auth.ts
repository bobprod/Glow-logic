import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";
import { getSetting, setSetting } from "../services/database";
import { addSupportLog } from "../services/supportLog";

const API_TOKEN_KEY = "api_token";
const ALLOWED_ORIGINS_KEY = "allowed_origins";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function ensureApiToken() {
  const existing = getSetting(API_TOKEN_KEY);
  if (existing && /^[a-f0-9]{64}$/i.test(existing)) return existing;
  const token = generateToken();
  setSetting(API_TOKEN_KEY, token);
  addSupportLog("AUTH", "Token API local genere", "info");
  return token;
}

export function regenerateApiToken() {
  const token = generateToken();
  setSetting(API_TOKEN_KEY, token);
  addSupportLog("AUTH", "Token API local regenere", "warning");
  return token;
}

export function getAllowedOrigins() {
  const raw = getSetting(ALLOWED_ORIGINS_KEY);
  if (!raw) {
    setSetting(ALLOWED_ORIGINS_KEY, JSON.stringify(DEFAULT_ALLOWED_ORIGINS));
    return DEFAULT_ALLOWED_ORIGINS;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const origins = parsed.filter((origin): origin is string => typeof origin === "string" && /^https?:\/\//.test(origin));
      return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
    }
  } catch {}
  return DEFAULT_ALLOWED_ORIGINS;
}

function extractBearer(header: unknown) {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function isLoopback(req: Request) {
  const candidates = [
    req.ip,
    req.socket.remoteAddress,
    req.headers["x-forwarded-for"],
  ].flatMap((value) => String(value || "").split(",").map((part) => part.trim()));

  return candidates.some((address) => (
    address === "127.0.0.1"
    || address === "::1"
    || address === "::ffff:127.0.0.1"
    || address === "localhost"
  ));
}

function tokenMatches(candidate: string | null) {
  if (!candidate) return false;
  const expected = ensureApiToken();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (tokenMatches(extractBearer(req.headers.authorization))) return next();
  addSupportLog("AUTH", "Requete API refusee", "warning", {
    path: req.path,
    method: req.method,
    ip: req.ip || req.socket.remoteAddress,
  });
  return res.status(401).json({ error: "unauthorized" });
}

export function requireSocketAuth(socket: Socket, next: (err?: Error) => void) {
  const token = typeof socket.handshake.auth?.token === "string"
    ? socket.handshake.auth.token
    : extractBearer(socket.handshake.headers.authorization);
  if (tokenMatches(token)) return next();
  addSupportLog("AUTH", "Connexion Socket.IO refusee", "warning", {
    ip: socket.handshake.address,
  });
  return next(new Error("unauthorized"));
}

export function maskToken(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}
