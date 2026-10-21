import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetSettingsApiError, petSettingsService } from "../services/petSettings.service.ts";

export function createPetSettingsNavigationGuard(state: { dirty: boolean; busy: boolean; uncertain: boolean }, confirmDiscard: () => boolean) {
  return {
    hasPendingChanges: () => state.busy || state.dirty || state.uncertain,
    canLeave: () => !state.busy && (!(state.dirty || state.uncertain) || confirmDiscard()),
  };
}

export function petSettingsQuery(localId: string) {
  const enabled = localId.trim().length > 0;
  return queryOptions({ queryKey: queryKeys.petSettings.detail(localId), enabled, retry: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 0,
    queryFn: ({ signal }) => enabled ? petSettingsService.get(signal) : Promise.reject(new PetSettingsApiError(0)) });
}

export const petSettingsMutationPolicy = () => ({ retry: false } as const);
export const acquirePetSettingsWriteLock = (lock: { current: boolean }) => {
  if (lock.current) return false;
  lock.current = true;
  return true;
};

export async function invalidatePetSettingsDependencies(client: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> }, localId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.petSettings.detail(localId) }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.availabilityAll }),
    client.invalidateQueries({ queryKey: queryKeys.petTurnoDisponibilidad.all }),
  ]);
}
