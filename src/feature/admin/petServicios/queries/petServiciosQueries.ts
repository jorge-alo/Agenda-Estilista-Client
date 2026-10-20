import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetServiciosApiError, petServiciosService } from "../services/petServicios.service.ts";

export function petServiciosQuery(localId: string) {
  const valid = localId.trim().length > 0;
  return queryOptions({
    queryKey: queryKeys.petServicios.all(localId),
    enabled: valid,
    queryFn: ({ signal }) => {
      if (!valid) throw new PetServiciosApiError(0);
      return petServiciosService.getPetServicios(signal);
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
  });
}

export function petServicioMutationPolicy() {
  return { retry: false } as const;
}

export function petServicioWriteIsUncertain(error: unknown): boolean {
  if (!(error instanceof PetServiciosApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.status >= 200 && error.status < 300;
}

export type PetServicioWriteResult<T> =
  | { kind: "success"; value: T }
  | { kind: "not-found"; error: unknown; refreshed: boolean }
  | { kind: "uncertain"; error: unknown; refreshed: boolean }
  | { kind: "known-error"; error: unknown };

export async function petServicioWriteWithRecovery<T>(
  write: () => Promise<T>,
  refresh: () => Promise<boolean>,
): Promise<PetServicioWriteResult<T>> {
  try {
    return { kind: "success", value: await write() };
  } catch (error: unknown) {
    if (error instanceof PetServiciosApiError && error.status === 404) {
      return { kind: "not-found", error, refreshed: await refresh().catch(() => false) };
    }
    if (petServicioWriteIsUncertain(error)) {
      return { kind: "uncertain", error, refreshed: await refresh().catch(() => false) };
    }
    return { kind: "known-error", error };
  }
}
