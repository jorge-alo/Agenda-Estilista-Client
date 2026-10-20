import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetManagementApiError, petManagementService } from "../services/petManagement.service.ts";
import {
  PET_MANAGEMENT_ESTADOS,
  PET_MANAGEMENT_SEARCH_LIMIT,
  PET_MANAGEMENT_SEARCH_MAX_LENGTH,
  PET_MANAGEMENT_SEARCH_MIN_LENGTH,
  type PetManagementEstado,
} from "../types/petManagement.types.ts";
import { petManagementValidId } from "../state/petManagementState.ts";

const searchPolicy = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
} as const;

const detailPolicy = {
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
} as const;

function localIdValido(localId: string): boolean {
  return localId.trim().length > 0;
}

function estadoValido(estado: PetManagementEstado): boolean {
  return (PET_MANAGEMENT_ESTADOS as readonly string[]).includes(estado);
}

export function petManagementSearchQuery(
  localId: string,
  q: string,
  estado: PetManagementEstado,
  limit = PET_MANAGEMENT_SEARCH_LIMIT,
) {
  const term = q.trim();
  const valid = localIdValido(localId)
    && term.length >= PET_MANAGEMENT_SEARCH_MIN_LENGTH
    && term.length <= PET_MANAGEMENT_SEARCH_MAX_LENGTH
    && estadoValido(estado)
    && Number.isInteger(limit)
    && limit >= 1
    && limit <= PET_MANAGEMENT_SEARCH_LIMIT;
  return queryOptions({
    ...searchPolicy,
    queryKey: queryKeys.petManagement.search(localId, term, estado, limit),
    enabled: valid,
    queryFn: ({ signal }) => {
      if (!valid) throw new PetManagementApiError(0, null);
      return petManagementService.buscarMascotas({ q: term, estado, limit, signal });
    },
  });
}

export function petManagementDetailQuery(localId: string, mascotaId: number | null) {
  const valid = localIdValido(localId) && petManagementValidId(mascotaId);
  return queryOptions({
    ...detailPolicy,
    queryKey: queryKeys.petManagement.detail(localId, mascotaId),
    enabled: valid,
    queryFn: ({ signal }) => {
      if (!valid || mascotaId === null) throw new PetManagementApiError(0, null);
      return petManagementService.obtenerMascota(mascotaId, { signal }).then(value => {
        if (value.id !== mascotaId) throw new PetManagementApiError(200, null);
        return value;
      });
    },
  });
}
