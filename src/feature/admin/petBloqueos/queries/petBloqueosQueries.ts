import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetBloqueosApiError, petBloqueosService } from "../services/petBloqueos.service.ts";
import { petBloqueoPayloadMatches } from "../types/petBloqueos.types.ts";
import type { PetBloqueo, PetBloqueoWrite } from "../types/petBloqueos.types.ts";

export function petBloqueosQuery(localId: string) {
  const enabled = localId.trim().length > 0;
  return queryOptions({ queryKey: queryKeys.petBloqueos.all(localId), enabled, retry: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 0,
    queryFn: ({ signal }) => enabled ? petBloqueosService.get(signal) : Promise.reject(new PetBloqueosApiError(0)) });
}

export const petBloqueoMutationPolicy = () => ({ retry: false } as const);

export function acquirePetBloqueoWriteLock(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export async function invalidatePetBloqueoDependencies(client: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> }, localId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.petBloqueos.all(localId) }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.availabilityAll }),
    client.invalidateQueries({ queryKey: queryKeys.petTurnoDisponibilidad.all }),
  ]);
}

export type PetBloqueoVerification =
  | { kind: "create"; expected: PetBloqueoWrite; previousIds: readonly number[] }
  | { kind: "update"; id: number; expected: PetBloqueoWrite }
  | { kind: "delete"; id: number };

export function petBloqueoChangeApplied(records: readonly PetBloqueo[], pending: PetBloqueoVerification): boolean {
  if (pending.kind === "delete") return !records.some(item => item.id === pending.id);
  if (pending.kind === "update") return records.some(item => item.id === pending.id && petBloqueoPayloadMatches(item, pending.expected));
  return records.some(item => !pending.previousIds.includes(item.id) && petBloqueoPayloadMatches(item, pending.expected));
}

export function petBloqueoWriteIsUncertain(error: unknown): boolean {
  return !(error instanceof PetBloqueosApiError) || error.status === 0 || error.status >= 500 || error.status >= 200 && error.status < 300;
}
