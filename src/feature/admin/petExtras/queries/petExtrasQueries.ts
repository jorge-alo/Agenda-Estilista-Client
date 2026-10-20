import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetExtrasApiError, petExtrasService } from "../services/petExtras.service.ts";

export function petExtrasQuery(localId: string) {
  const valid = localId.trim().length > 0;
  return queryOptions({
    queryKey: queryKeys.petExtras.all(localId),
    enabled: valid,
    queryFn: ({ signal }) => {
      if (!valid) throw new PetExtrasApiError(0);
      return petExtrasService.getPetExtras(signal);
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
  });
}

export function petExtraMutationPolicy() {
  return { retry: false } as const;
}

export function petExtraWriteIsUncertain(error: unknown): boolean {
  if (!(error instanceof PetExtrasApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.status >= 200 && error.status < 300;
}

export type PetExtraWriteResult<T> =
  | { kind: "success"; value: T }
  | { kind: "not-found"; error: unknown; refreshed: boolean }
  | { kind: "uncertain"; error: unknown; refreshed: boolean }
  | { kind: "known-error"; error: unknown };

export async function petExtraWriteWithRecovery<T>(
  write: () => Promise<T>,
  refresh: () => Promise<boolean>,
): Promise<PetExtraWriteResult<T>> {
  try {
    return { kind: "success", value: await write() };
  } catch (error: unknown) {
    if (error instanceof PetExtrasApiError && error.status === 404) {
      return { kind: "not-found", error, refreshed: await refresh().catch(() => false) };
    }
    if (petExtraWriteIsUncertain(error)) {
      return { kind: "uncertain", error, refreshed: await refresh().catch(() => false) };
    }
    return { kind: "known-error", error };
  }
}
