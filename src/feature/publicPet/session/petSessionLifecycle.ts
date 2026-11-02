import { petSessionStorageKey, readPetSession, samePetSession, type StoredPetSession } from "./petSessionStorage.ts";

interface LifecycleEnvironment {
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
  now: () => number;
  schedule: (callback: () => void, delay: number) => () => void;
}

/** The hook and tests share the actual event/timer orchestration. No polling. */
export function watchPetSession(
  slug: string,
  expected: StoredPetSession | null,
  onChange: () => void,
  onExpire: () => void,
  onRevalidate: () => void,
  environment: LifecycleEnvironment = {
    window, document, now: Date.now,
    schedule: (callback, delay) => { const timer = window.setTimeout(callback, delay); return () => window.clearTimeout(timer); },
  },
): () => void {
  let active = true;
  const changed = () => !samePetSession(readPetSession(slug), expected);
  const storage = (event: Event) => {
    const key = (event as StorageEvent).key;
    if (active && (key === null || key === petSessionStorageKey(slug)) && changed()) onChange();
  };
  const visible = () => {
    if (!active || environment.document.visibilityState !== "visible") return;
    if (expected && Date.parse(expected.expiresAt) <= environment.now()) onExpire();
    else if (changed()) onChange();
    else if (expected) onRevalidate();
  };
  const cancelTimer = expected ? environment.schedule(() => {
    if (!active) return;
    if (Date.parse(expected.expiresAt) <= environment.now()) onExpire();
  }, Math.max(0, Date.parse(expected.expiresAt) - environment.now())) : () => {};
  environment.window.addEventListener("storage", storage);
  environment.document.addEventListener("visibilitychange", visible);
  return () => {
    active = false;
    cancelTimer();
    environment.window.removeEventListener("storage", storage);
    environment.document.removeEventListener("visibilitychange", visible);
  };
}
