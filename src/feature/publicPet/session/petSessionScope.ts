import { removeExpectedPetSession, type StoredPetSession } from "./petSessionStorage.ts";

export interface PetSessionScopeRef {
  slug: string;
  sessionScope: string;
}

const currentScopes = new Map<string, string>();
const credentials = new Map<string, StoredPetSession>();
const revisions = new Map<string, number>();

export function petSessionRevision(slug: string): number { return revisions.get(slug) ?? 0; }

/** Non-secret, memory-only ID. It must never be derived from or stored with the Bearer token. */
export function createPetSessionScope(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  return `pet-scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function activatePetSessionScope(slug: string, scope = createPetSessionScope(), session?: StoredPetSession): string {
  currentScopes.set(slug, scope);
  if (session) credentials.set(slug, session);
  else credentials.delete(slug);
  return scope;
}

export function currentPetSessionScope(slug: string): string | null {
  return currentScopes.get(slug) ?? null;
}

export function petSessionScopeCredential(slug: string, scope: string): StoredPetSession | null {
  return isCurrentPetSessionScope(slug, scope) ? credentials.get(slug) ?? null : null;
}

export function isCurrentPetSessionScope(slug: string, scope: string): boolean {
  return currentScopes.get(slug) === scope;
}

export function releasePetSessionScope(slug: string, scope: string): boolean {
  if (currentScopes.get(slug) !== scope) return false;
  clearPetSessionScope(slug);
  return true;
}

export function clearPetSessionScope(slug: string): void {
  currentScopes.delete(slug);
  credentials.delete(slug);
  revisions.set(slug, petSessionRevision(slug) + 1);
}

/** Only removes the PET session of that slug; admin auth is never touched here. */
export function invalidateCurrentPetSession(slug: string, scope: string): boolean {
  if (!isCurrentPetSessionScope(slug, scope)) return false;
  const expected = credentials.get(slug);
  if (expected) removeExpectedPetSession(slug, expected);
  clearPetSessionScope(slug);
  return true;
}
