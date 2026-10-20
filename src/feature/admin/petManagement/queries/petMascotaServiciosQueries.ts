import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { petMascotaServiciosService } from "../services/petMascotaServicios.service.ts";
import { petServicioEnteroValido } from "../types/petMascotaServicios.types.ts";

export function petMascotaServiciosQuery(localId: string, mascotaId: number | null) {
  return queryOptions({
    queryKey: queryKeys.petMascotaServicios.all(localId, mascotaId),
    enabled: Boolean(localId.trim()) && petServicioEnteroValido(mascotaId),
    queryFn: ({ signal }) => petMascotaServiciosService.getPetMascotaServicios(mascotaId!, signal),
    retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true,
  });
}

export type PetMascotaServicioAction = { servicioId: number } &
  ({ kind: "add" | "update"; duracionMinutos: number } | { kind: "remove" });

export function petMascotaServicioMutation(localId: string) {
  return {
    mutationKey: ["pet-mascota-servicios", localId, "write"], retry: false as const,
    mutationFn: ({ mascotaId, action }: { mascotaId: number; action: PetMascotaServicioAction }) => {
      if (action.kind === "remove") return petMascotaServiciosService.removePetMascotaServicio(mascotaId, action.servicioId);
      if (action.kind === "add") return petMascotaServiciosService.addPetMascotaServicio(mascotaId, action);
      return petMascotaServiciosService.updatePetMascotaServicio(mascotaId, action.servicioId, { duracionMinutos: action.duracionMinutos });
    },
  };
}

export async function invalidatePetMascotaServicios(client: QueryClient, mascotaId: number) {
  await Promise.allSettled([
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.servicios(mascotaId), exact: true }),
    client.invalidateQueries({ queryKey: [...queryKeys.petAdminBooking.availabilityAll, mascotaId] }),
    client.invalidateQueries({ predicate: ({ queryKey: key }) => key[0] === "pet-public-booking" && key[4] === mascotaId
      && (key[3] === "options" || key[3] === "availability") }),
  ]);
}
