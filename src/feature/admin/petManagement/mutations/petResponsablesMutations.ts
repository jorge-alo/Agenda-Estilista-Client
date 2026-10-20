import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import type { ResponsableDraft } from "../forms/petResponsableForm.ts";
import { PetManagementApiError } from "../services/petManagement.service.ts";
import { petResponsablesService } from "../services/petResponsables.service.ts";

export async function invalidateResponsables(client: QueryClient, localId: string, mascotaId: number, error: unknown) {
  if (error instanceof PetManagementApiError && [400, 401, 403].includes(error.status)) return;
  await Promise.allSettled([
    // The controller performs a fresh post-write GET, including when the write is uncertain.
    client.invalidateQueries({ queryKey: queryKeys.petManagement.detail(localId, mascotaId), exact: true, refetchType: "none" }),
    client.invalidateQueries({ queryKey: queryKeys.petManagement.searches(localId) }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.mascotaDetail(mascotaId), exact: true }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.searches() }),
  ]);
}

export function createResponsableMutation(_client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "create-responsable"],
    retry: false as const,
    mutationFn: (draft: ResponsableDraft) => petResponsablesService.createResponsable(draft),
  };
}

export function associateResponsableMutation(client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "associate-responsable"],
    retry: false as const,
    mutationFn: ({ mascotaId, clienteId }: { mascotaId: number; clienteId: number }) =>
      petResponsablesService.associateResponsable(mascotaId, clienteId),
    onSettled: (_data: unknown, error: unknown, input: { mascotaId: number; clienteId: number }) =>
      invalidateResponsables(client, localId, input.mascotaId, error),
  };
}

export function removeResponsableMutation(client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "remove-responsable"],
    retry: false as const,
    mutationFn: ({ mascotaId, clienteId }: { mascotaId: number; clienteId: number }) =>
      petResponsablesService.removeResponsable(mascotaId, clienteId),
    onSettled: (_data: unknown, error: unknown, input: { mascotaId: number; clienteId: number }) =>
      invalidateResponsables(client, localId, input.mascotaId, error),
  };
}
