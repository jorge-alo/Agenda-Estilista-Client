import { removePetSession } from "./petSessionStorage.ts";

export interface PetSessionScopeRef {
  slug: string;
  sessionScope: string;
}

const currentScopes = new Map<string, string>();

/** Non-secret, memory-only ID. It must never be derived from or stored with the Bearer token. */
export function createPetSessionScope(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  return `pet-scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function activatePetSessionScope(slug: string, scope = createPetSessionScope()): string {
  currentScopes.set(slug, scope);
  return scope;
}

export function currentPetSessionScope(slug: string): string | null {
  return currentScopes.get(slug) ?? null;
}

export function isCurrentPetSessionScope(slug: string, scope: string): boolean {
  return currentScopes.get(slug) === scope;
}

export function releasePetSessionScope(slug: string, scope: string): boolean {
  if (currentScopes.get(slug) !== scope) return false;
  currentScopes.delete(slug);
  return true;
}

export function clearPetSessionScope(slug: string): void {
  currentScopes.delete(slug);
}

/** Only removes the PET session of that slug; admin auth is never touched here. */
export function invalidateCurrentPetSession(slug: string, scope: string): boolean {
  if (!isCurrentPetSessionScope(slug, scope)) return false;
  currentScopes.delete(slug);
  removePetSession(slug);
  return true;
}
