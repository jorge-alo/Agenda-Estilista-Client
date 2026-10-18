export interface StoredPetSession {
  token: string;
  expiresAt: string;
}

const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ISO_UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalPetToken(value: unknown): value is string {
  if (typeof value !== "string" || !OPAQUE_TOKEN.test(value)) return false;
  try {
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(standard + "=");
    const canonical = btoa(decoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return decoded.length === 32 && canonical === value;
  } catch {
    return false;
  }
}

export function petSessionStorageKey(slug: string): string {
  return `agendaok:pet-session:${encodeURIComponent(slug)}`;
}

function validSession(value: unknown, now: number): value is StoredPetSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  if (Object.keys(session).length !== 2 || !isCanonicalPetToken(session.token) ||
      typeof session.expiresAt !== "string" || !ISO_UTC_MILLISECONDS.test(session.expiresAt)) return false;
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function parseStoredPetSession(raw: string | null, now = Date.now()): StoredPetSession | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validSession(parsed, now) ? { token: parsed.token, expiresAt: parsed.expiresAt } : null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

export function readPetSession(slug: string, now = Date.now(), storage = getSessionStorage()): StoredPetSession | null {
  if (!storage) return null;
  const key = petSessionStorageKey(slug);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const session = parseStoredPetSession(raw, now);
    if (!session) storage.removeItem(key);
    return session;
  } catch {
    return null;
  }
}

export function writePetSession(slug: string, session: StoredPetSession, storage = getSessionStorage()): boolean {
  if (!storage || !validSession(session, Date.now())) return false;
  try {
    // The challenge is never passed here; only the server-issued session pair is stored.
    storage.setItem(petSessionStorageKey(slug), JSON.stringify({ token: session.token, expiresAt: session.expiresAt }));
    return true;
  } catch {
    return false;
  }
}

export function removePetSession(slug: string, storage = getSessionStorage()): void {
  if (!storage) return;
  try { storage.removeItem(petSessionStorageKey(slug)); } catch { /* sessionStorage may be unavailable */ }
}
