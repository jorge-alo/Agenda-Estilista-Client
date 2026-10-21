import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetHorariosApiError, petHorariosService } from "../services/petHorarios.service.ts";

export function petHorariosQuery(localId: string) {
  const enabled = localId.trim().length > 0;
  return queryOptions({ queryKey: queryKeys.petHorarios.all(localId), enabled, retry: false,
    refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 0,
    queryFn: ({ signal }) => enabled ? petHorariosService.get(signal) : Promise.reject(new PetHorariosApiError(0)) });
}

export const petHorarioMutationPolicy = () => ({ retry: false } as const);

export function petHorarioWriteIsUncertain(error: unknown): boolean {
  return !(error instanceof PetHorariosApiError) || error.status === 0 || error.status >= 500 || error.status >= 200 && error.status < 300;
}

export async function petHorarioWriteWithRecovery<T>(write: () => Promise<T>, refresh: () => Promise<boolean>) {
  try { return { kind: "success" as const, value: await write() }; }
  catch (error: unknown) {
    if (error instanceof PetHorariosApiError && error.status === 404) return { kind: "not-found" as const, error, refreshed: await refresh().catch(() => false) };
    if (petHorarioWriteIsUncertain(error)) return { kind: "uncertain" as const, error, refreshed: await refresh().catch(() => false) };
    return { kind: "known-error" as const, error };
  }
}

export async function invalidatePetHorarioDependencies(client: { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> }, localId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.petHorarios.all(localId) }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.availabilityAll }),
    client.invalidateQueries({ queryKey: queryKeys.petTurnoDisponibilidad.all }),
  ]);
}
