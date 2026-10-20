import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { petMascotaExtrasService } from "../services/petMascotaExtras.service.ts";
import { petExtraEnteroValido } from "../types/petMascotaExtras.types.ts";

export function petMascotaExtrasQuery(localId: string, mascotaId: number | null) {
  return queryOptions({
    queryKey: queryKeys.petMascotaExtras.all(localId, mascotaId),
    enabled: Boolean(localId.trim()) && petExtraEnteroValido(mascotaId),
    queryFn: ({ signal }) => petMascotaExtrasService.getPetMascotaExtras(mascotaId!, signal),
    retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true,
  });
}

export type PetMascotaExtraAction = { extraId: number } &
  ({ kind: "add" | "update"; duracionMinutos: number } | { kind: "remove" });

export function petMascotaExtraMutation(localId: string) {
  return {
    mutationKey: ["pet-mascota-extras", localId, "write"], retry: false as const,
    mutationFn: ({ mascotaId, action }: { mascotaId: number; action: PetMascotaExtraAction }) => {
      if (action.kind === "remove") return petMascotaExtrasService.removePetMascotaExtra(mascotaId, action.extraId);
      if (action.kind === "add") return petMascotaExtrasService.addPetMascotaExtra(mascotaId, action);
      return petMascotaExtrasService.updatePetMascotaExtra(mascotaId, action.extraId, { duracionMinutos: action.duracionMinutos });
    },
  };
}

export async function invalidatePetMascotaExtras(client: QueryClient, mascotaId: number) {
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.extras(mascotaId), exact: true }),
    client.invalidateQueries({ queryKey: [...queryKeys.petAdminBooking.availabilityAll, mascotaId] }),
    client.invalidateQueries({ predicate: ({ queryKey: key }) => key[0] === "pet-public-booking" && key[4] === mascotaId
      && (key[3] === "options" || key[3] === "availability") }),
  ]);
}
