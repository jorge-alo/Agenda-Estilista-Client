import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { petManagementService } from "../services/petManagement.service.ts";
import type { MascotaData, MascotaDataPatch } from "../forms/petMascotaForm.ts";

export async function invalidateMascotaData(client: QueryClient, localId: string, id: number, patch?: MascotaDataPatch) {
  // Refetch failures must not reclassify an already-confirmed write as a failed POST/PATCH.
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: queryKeys.petManagement.searches(localId) }),
    client.invalidateQueries({ queryKey: queryKeys.petManagement.detail(localId, id), exact: true }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.searches() }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.mascotas(), exact: true }),
    ...(patch ? [client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.mascotaDetail(id), exact: true })] : []),
    // Agenda shows the current pet name (JOIN), not a name snapshot. No historical data is written.
    ...(patch?.nombre !== undefined ? [client.invalidateQueries({ queryKey: queryKeys.petTurnos.all })] : []),
  ]);
}

export function createMascotaMutation(client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "create"],
    retry: false as const,
    mutationFn: (data: MascotaData) => petManagementService.createMascota(data),
    onSuccess: (result: { id: number }) => invalidateMascotaData(client, localId, result.id),
  };
}

export function updateMascotaDataMutation(client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "update-data"],
    retry: false as const,
    mutationFn: ({ id, patch }: { id: number; patch: MascotaDataPatch }) => petManagementService.updateMascotaData(id, patch),
    onSuccess: (result: { id: number }, input: { id: number; patch: MascotaDataPatch }) =>
      invalidateMascotaData(client, localId, result.id, input.patch),
  };
}
