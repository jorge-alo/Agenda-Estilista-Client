export function acquirePetExtraWriteLock(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releasePetExtraWriteLock(lock: { current: boolean }): void {
  lock.current = false;
}
