import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetManagementApiError } from "../services/petManagement.service.ts";
import { petMascotaFlagsService } from "../services/petMascotaFlags.service.ts";
import type { MascotaFlagChange } from "../types/petMascotaFlags.types.ts";

interface Input { mascotaId: number; change: MascotaFlagChange }

export async function invalidateMascotaFlag(client: QueryClient, localId: string, input: Input, error: unknown) {
  if (error instanceof PetManagementApiError && [400, 401, 403].includes(error.status)) return;
  const { mascotaId, change: { flag } } = input;
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: queryKeys.petManagement.detail(localId, mascotaId), exact: true, refetchType: "none" }),
    ...(flag === "activo" ? [
      client.invalidateQueries({ queryKey: queryKeys.petManagement.searches(localId) }),
      client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.searches() }),
    ] : []),
    // Booking DTOs expose activo/online, but not altaExigencia. Search results expose neither online nor exigencia.
    ...(flag !== "altaExigencia" ? [
      client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.mascotas(), exact: true }),
      client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.mascotaDetail(mascotaId), exact: true }),
    ] : []),
    ...(flag !== "reservaOnlineHabilitada" ? [
      client.invalidateQueries({ queryKey: [...queryKeys.petAdminBooking.availabilityAll, mascotaId] }),
    ] : []),
    // Public keys carry globally unique mascota IDs, not localId. Only this pet's live options/availability depend on flags.
    client.invalidateQueries({ predicate: ({ queryKey: key }) => key[0] === "pet-public-booking" && key[4] === mascotaId
      && (key[3] === "availability" || (flag !== "altaExigencia" && key[3] === "options")) }),
  ]);
}

export function updateMascotaFlagMutation(client: QueryClient, localId: string) {
  return {
    mutationKey: [...queryKeys.petManagement.scope(localId), "update-flag"],
    retry: false as const,
    mutationFn: ({ mascotaId, change }: Input) => petMascotaFlagsService.update(mascotaId, change),
    onSettled: (_data: unknown, error: unknown, input: Input) => invalidateMascotaFlag(client, localId, input, error),
  };
}
