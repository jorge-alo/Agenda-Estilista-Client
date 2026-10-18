import { isCanonicalPetToken, readPetSession, removePetSession, writePetSession, type StoredPetSession } from "./petSessionStorage.ts";
import { runOnceByKey } from "./singleFlight.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";

export interface PetPublicProfile {
  cliente: { nombre: string };
  mascotas: Array<{ id: number; nombre: string }>;
}

export type PetSessionFlowResult =
  | { status: "authenticated"; session: StoredPetSession; profile: PetPublicProfile }
  | { status: "unauthenticated" }
  | { status: "invalid-link" }
  | { status: "local-unavailable" }
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

const restoreFlights = new Map<string, Promise<PetSessionFlowResult>>();
const consumeFlights = new Map<string, Promise<PetSessionFlowResult>>();

function sessionPath(slug: string, endpoint: "consume" | "me" | "logout"): string {
  return `${API_URL}/api/pet/public/${encodeURIComponent(slug)}/session/${endpoint}`;
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
      return { status: "authenticated", session, profile };
    } catch (error) {
      if (error instanceof PetSessionApiError && error.status === 401) removePetSession(slug);
      return resultFromError(error, "consume");
    }
  });
}

export function restorePetSessionOnce(slug: string): Promise<PetSessionFlowResult> {
  return runOnceByKey(restoreFlights, slug, async () => {
    const session = readPetSession(slug);
    if (!session) return { status: "unauthenticated" };
    try {
      const profile = await getMe(slug, session);
      return { status: "authenticated", session, profile };
    } catch (error) {
      if (error instanceof PetSessionApiError && error.status === 401) {
        removePetSession(slug);
        return { status: "unauthenticated" };
      }
      return resultFromError(error, "restore");
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
