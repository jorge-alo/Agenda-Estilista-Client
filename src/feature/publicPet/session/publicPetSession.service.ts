import { isCanonicalPetToken, readPetSession, removePetSession, writePetSession, type StoredPetSession } from "./petSessionStorage.ts";
import {
  activatePetSessionScope, clearPetSessionScope, invalidateCurrentPetSession, isCurrentPetSessionScope, releasePetSessionScope,
} from "./petSessionScope.ts";
import { runOnceByKey } from "./singleFlight.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";

export interface PetPublicProfile {
  cliente: { nombre: string };
  mascotas: Array<{ id: number; nombre: string }>;
}

export type PetSessionFlowResult =
  | { status: "authenticated"; session: StoredPetSession; profile: PetPublicProfile; sessionScope: string }
  | { status: "unauthenticated" }
  | { status: "invalid-link" }
  | { status: "local-unavailable" }
  | { status: "error" };

export type PetProfileRefreshResult =
  | { status: "refreshed"; profile: PetPublicProfile }
  | { status: "unauthorized" }
  | { status: "stale" }
  | { status: "error" };

export class PetSessionApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super("PET_SESSION_REQUEST_FAILED");
    this.status = status;
    this.code = code;
  }
}

export type PetAccessPhoneValidation = "required" | "too-long" | null;
export const PET_ACCESS_REQUEST_SUCCESS_MESSAGE = "Si encontramos una cuenta habilitada con ese número, te enviamos un enlace por WhatsApp.";

export function petAccessRequestErrorMessage(error: unknown): string {
  if (error instanceof PetSessionApiError && error.status === 429) {
    return "Hay demasiados intentos. Probá nuevamente más tarde.";
  }
  if (error instanceof PetSessionApiError && error.status === 404) return "Este local no está disponible.";
  return "No pudimos procesar la solicitud en este momento. Intentá nuevamente más tarde.";
}

export function validatePetAccessPhone(value: unknown): PetAccessPhoneValidation {
  if (typeof value !== "string" || value.trim().length === 0) return "required";
  if (value.length > 50) return "too-long";
  return null;
}

const restoreFlights = new Map<string, Promise<PetSessionFlowResult>>();
const consumeFlights = new Map<string, Promise<PetSessionFlowResult>>();

function sessionPath(slug: string, endpoint: "consume" | "me" | "logout"): string {
  return `${API_URL}/api/pet/public/${encodeURIComponent(slug)}/session/${endpoint}`;
}

export async function requestPetAccessLink(slug: string, telefono: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/pet/public/${encodeURIComponent(slug)}/session/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono }),
      cache: "no-store",
    });
  } catch { throw new PetSessionApiError(0); }
  if (response.status !== 202) throw new PetSessionApiError(response.status);
  // The API intentionally returns the same 202 body for all phone outcomes.
  // Do not inspect or infer any recipient state from it.
}

async function errorFrom(response: Response): Promise<PetSessionApiError> {
  let code: string | null = null;
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const value = (payload as Record<string, unknown>).error;
      if (typeof value === "string" && /^[A-Z0-9_]{1,64}$/.test(value)) code = value;
    }
  } catch { /* response bodies are never copied into errors/logs */ }
  return new PetSessionApiError(response.status, code);
}

async function consume(slug: string, challenge: string): Promise<StoredPetSession> {
  if (!isCanonicalPetToken(challenge)) throw new PetSessionApiError(401, "PET_ACCESS_INVALID");
  let response: Response;
  try {
    response = await fetch(sessionPath(slug, "consume"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: challenge }),
      cache: "no-store",
    });
  } catch { throw new PetSessionApiError(0); }
  if (!response.ok) throw await errorFrom(response);

  let payload: unknown;
  try { payload = await response.json(); } catch { throw new PetSessionApiError(0); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new PetSessionApiError(0);
  const result = payload as Record<string, unknown>;
  const session = { token: result.sessionToken, expiresAt: result.expiresAt };
  if (Object.keys(result).length !== 2 || !isCanonicalPetToken(session.token) ||
      typeof session.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(session.expiresAt) ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) {
    throw new PetSessionApiError(0);
  }
  return { token: session.token, expiresAt: session.expiresAt };
}

function parseProfile(payload: unknown): PetPublicProfile {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new PetSessionApiError(0);
  const result = payload as Record<string, unknown>;
  if (!result.cliente || typeof result.cliente !== "object" || Array.isArray(result.cliente) || !Array.isArray(result.mascotas)) {
    throw new PetSessionApiError(0);
  }
  const client = result.cliente as Record<string, unknown>;
  if (typeof client.nombre !== "string") throw new PetSessionApiError(0);
  const mascotas: PetPublicProfile["mascotas"] = [];
  for (const item of result.mascotas) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new PetSessionApiError(0);
    const pet = item as Record<string, unknown>;
    if (!Number.isSafeInteger(pet.id) || typeof pet.nombre !== "string") throw new PetSessionApiError(0);
    mascotas.push({ id: pet.id as number, nombre: pet.nombre });
  }
  return { cliente: { nombre: client.nombre }, mascotas };
}

async function getMe(slug: string, session: StoredPetSession): Promise<PetPublicProfile> {
  let response: Response;
  try {
    response = await fetch(sessionPath(slug, "me"), {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store",
    });
  } catch { throw new PetSessionApiError(0); }
  if (!response.ok) throw await errorFrom(response);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new PetSessionApiError(0); }
  return parseProfile(payload);
}

function resultFromError(error: unknown, phase: "consume" | "restore"): PetSessionFlowResult {
  if (!(error instanceof PetSessionApiError)) return { status: "error" };
  if (error.status === 401) return phase === "consume" ? { status: "invalid-link" } : { status: "unauthenticated" };
  if (error.status === 404) return { status: "local-unavailable" };
  return { status: "error" };
}

export function consumePetMagicLinkOnce(slug: string, challenge: string): Promise<PetSessionFlowResult> {
  return runOnceByKey(consumeFlights, slug, async () => {
    try {
      const session = await consume(slug, challenge);
      // Only a session returned by successful consume is persisted; the challenge is never stored.
      writePetSession(slug, session);
      const profile = await getMe(slug, session);
      return { status: "authenticated", session, profile, sessionScope: activatePetSessionScope(slug) };
    } catch (error) {
      if (error instanceof PetSessionApiError && error.status === 401) {
        removePetSession(slug);
        clearPetSessionScope(slug);
      }
      return resultFromError(error, "consume");
    }
  });
}

export function restorePetSessionOnce(slug: string): Promise<PetSessionFlowResult> {
  return runOnceByKey(restoreFlights, slug, async () => {
    const session = readPetSession(slug);
    if (!session) {
      clearPetSessionScope(slug);
      return { status: "unauthenticated" };
    }
    try {
      const profile = await getMe(slug, session);
      return { status: "authenticated", session, profile, sessionScope: activatePetSessionScope(slug) };
    } catch (error) {
      if (error instanceof PetSessionApiError && error.status === 401) {
        removePetSession(slug);
        clearPetSessionScope(slug);
        return { status: "unauthenticated" };
      }
      return resultFromError(error, "restore");
    }
  });
}

const refreshFlights = new Map<string, Promise<PetProfileRefreshResult>>();

/** Keeps the current authority visible while refreshing; only a scoped 401 removes the local session. */
export function refreshPetSessionProfileOnce(slug: string, sessionScope: string): Promise<PetProfileRefreshResult> {
  return runOnceByKey(refreshFlights, `${slug}\u0000${sessionScope}`, async () => {
    if (!isCurrentPetSessionScope(slug, sessionScope)) return { status: "stale" };
    const session = readPetSession(slug);
    if (!session) {
      releasePetSessionScope(slug, sessionScope);
      return { status: "unauthorized" };
    }
    try {
      const profile = await getMe(slug, session);
      if (!isCurrentPetSessionScope(slug, sessionScope)) return { status: "stale" };
      return { status: "refreshed", profile };
    } catch (error) {
      if (!isCurrentPetSessionScope(slug, sessionScope)) return { status: "stale" };
      if (error instanceof PetSessionApiError && error.status === 401) {
        invalidateCurrentPetSession(slug, sessionScope);
        return { status: "unauthorized" };
      }
      return { status: "error" };
    }
  });
}

export async function logoutPetSession(slug: string, token: string): Promise<void> {
  try {
    if (!isCanonicalPetToken(token)) return;
    const response = await fetch(sessionPath(slug, "logout"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw await errorFrom(response);
  } finally {
    // Always exit locally, even if the request fails or times out.
    removePetSession(slug);
  }
}
