import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { petSolicitudesService } from "../services/petSolicitudes.service.ts";
import type { PetSolicitudEstado } from "../types/petSolicitudes.types.ts";

export function petSolicitudesQuery(localId: string, estado: PetSolicitudEstado | null) {
  const enabled = localId.trim().length > 0;
  return queryOptions({ queryKey: queryKeys.petSolicitudes.list(localId, estado), enabled, retry: false, refetchOnWindowFocus: false, staleTime: 0,
    queryFn: ({ signal }) => enabled ? petSolicitudesService.list(estado, signal) : Promise.reject(new Error("localId requerido")) });
}
export const petSolicitudesMutationPolicy = () => ({ retry: false } as const);
export function acquirePetSolicitudWriteLock(lock: { current: boolean }) { if (lock.current) return false; lock.current = true; return true; }
export function createPetSolicitudesNavigationGuard(state: { dirty: boolean; busy: boolean; uncertain: boolean }, confirmDiscard: () => boolean) {
  return { hasPendingChanges: () => state.dirty || state.busy || state.uncertain, canLeave: () => !state.busy && (!(state.dirty || state.uncertain) || confirmDiscard()) };
}
export async function invalidatePetSolicitudes(client: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> }, localId: string) {
  await client.invalidateQueries({ queryKey: queryKeys.petSolicitudes.all(localId) });
}
