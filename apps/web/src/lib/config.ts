export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE
  || (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? `http://${window.location.hostname}:3005`
    : "http://localhost:3005");

const AUTH_STORAGE_KEY = "glowlogic_auth";
const PATCH_FLAG = "__glowlogic_auth_fetch__";

type StoredAuth = { token?: string };

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;
const nativeFetch = typeof window !== "undefined" ? window.fetch.bind(window) : null;

function readStoredToken() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "{}") as StoredAuth;
    return typeof parsed.token === "string" && parsed.token.trim() ? parsed.token.trim() : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  cachedToken = token.trim();
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: cachedToken }));
  }
}

export function clearAuthToken() {
  cachedToken = null;
  tokenPromise = null;
  if (typeof window !== "undefined") localStorage.removeItem(AUTH_STORAGE_KEY);
}

function isApiUrl(url: string) {
  if (url.startsWith("/api/")) return true;
  if (!API_BASE) return url.startsWith("/api/");
  try {
    const absolute = new URL(url, window.location.origin);
    const apiBase = new URL(API_BASE, window.location.origin);
    return absolute.origin === apiBase.origin && absolute.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function bootstrapToken() {
  if (!nativeFetch) return null;
  try {
    const response = await nativeFetch(`${API_BASE}/api/auth/bootstrap`, { method: "POST" });
    if (!response.ok) return null;
    const data = await response.json() as { token?: string };
    if (data.token) {
      setAuthToken(data.token);
      return data.token;
    }
  } catch {}
  return null;
}

export async function getAuthToken() {
  if (cachedToken) return cachedToken;
  const stored = readStoredToken();
  if (stored) {
    cachedToken = stored;
    return stored;
  }
  if (!tokenPromise) tokenPromise = bootstrapToken();
  return tokenPromise;
}

export async function ensureAuthToken() {
  const token = await getAuthToken();
  return Boolean(token);
}

function mergeAuthHeaders(init: RequestInit | undefined, token: string) {
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return { ...(init || {}), headers };
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const fetchImpl = nativeFetch || fetch;
  const token = await getAuthToken();
  return fetchImpl(input, token ? mergeAuthHeaders(init, token) : init);
}

export function installAuthFetch() {
  if (typeof window === "undefined" || !nativeFetch) return;
  const windowWithFlag = window as typeof window & { [PATCH_FLAG]?: boolean };
  if (windowWithFlag[PATCH_FLAG]) return;
  windowWithFlag[PATCH_FLAG] = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isApiUrl(url) || url.endsWith("/api/auth/bootstrap")) {
      return nativeFetch(input, init);
    }
    const token = await getAuthToken();
    return nativeFetch(input, token ? mergeAuthHeaders(init, token) : init);
  };
}

if (typeof window !== "undefined") {
  installAuthFetch();
}
