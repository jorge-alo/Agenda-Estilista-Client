import { queryOptions, type MutationObserverOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { PetAdminBookingApiError, petAdminBookingService } from "../services/petAdminBooking.service.ts";
import type { PetAdminAvailabilityInput, PetAdminCreateBookingInput, PetAdminCreatedBooking } from "../types/petAdminBooking.types.ts";
import { petAdminValidDate, petAdminValidId } from "./petAdminBookingState.ts";

const readingPolicy = {
  retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  staleTime: 0, gcTime: 0, placeholderData: undefined,
} as const;

export function petAdminMascotasQuery(allowReads = true) {
  return queryOptions({ ...readingPolicy, queryKey: queryKeys.petAdminBooking.mascotas(), enabled: allowReads,
    queryFn: ({ signal }) => petAdminBookingService.listarMascotas({ signal }) });
}

export function petAdminSearchMascotasQuery(q: string, limit = 20, allowReads = false) {
  const term = q.trim();
  const valid = (term.length === 0 || (term.length >= 2 && term.length <= 100))
    && Number.isInteger(limit) && limit >= 1 && limit <= 20;
  return queryOptions({ ...readingPolicy, queryKey: queryKeys.petAdminBooking.searchMascotas(term, limit),
    enabled: allowReads && valid,
    queryFn: ({ signal }) => {
      if (!valid) throw new PetAdminBookingApiError(0, null);
      return petAdminBookingService.buscarMascotas({ q: term, limit, signal });
    } });
}

export function petAdminDetailQuery(mascotaId: number | null, allowReads = true) {
  return queryOptions({ ...readingPolicy, queryKey: queryKeys.petAdminBooking.mascotaDetail(mascotaId),
    enabled: allowReads && petAdminValidId(mascotaId), queryFn: ({ signal }) => {
      if (!petAdminValidId(mascotaId)) throw new PetAdminBookingApiError(0, null);
      return petAdminBookingService.obtenerMascota(mascotaId, { signal }).then(value => {
        if (value.id !== mascotaId) throw new PetAdminBookingApiError(200, null);
        return value;
      });
    } });
}

export function petAdminServiciosQuery(mascotaId: number | null, allowReads = true) {
  return queryOptions({ ...readingPolicy, queryKey: queryKeys.petAdminBooking.servicios(mascotaId),
    enabled: allowReads && petAdminValidId(mascotaId), queryFn: ({ signal }) => {
      if (!petAdminValidId(mascotaId)) throw new PetAdminBookingApiError(0, null);
      return petAdminBookingService.listarServicios(mascotaId, { signal });
    } });
}

export function petAdminExtrasQuery(mascotaId: number | null, allowReads = true) {
  return queryOptions({ ...readingPolicy, queryKey: queryKeys.petAdminBooking.extras(mascotaId),
    enabled: allowReads && petAdminValidId(mascotaId), queryFn: ({ signal }) => {
      if (!petAdminValidId(mascotaId)) throw new PetAdminBookingApiError(0, null);
      return petAdminBookingService.listarExtras(mascotaId, { signal });
    } });
}

export function petAdminAvailabilityQuery(input: PetAdminAvailabilityInput | null, allowReads = true) {
  const selection = input ? { ...input, extraIds: [...input.extraIds].sort((a, b) => a - b) } : null;
  const valid = selection !== null && petAdminValidId(selection.mascotaId) && petAdminValidId(selection.servicioId)
    && petAdminValidDate(selection.fecha) && selection.extraIds.every(petAdminValidId)
    && new Set(selection.extraIds).size === selection.extraIds.length;
  return queryOptions({ ...readingPolicy,
    queryKey: queryKeys.petAdminBooking.availability(selection?.mascotaId ?? null, selection?.servicioId ?? null,
      selection?.extraIds ?? [], selection?.fecha ?? ""),
    enabled: allowReads && valid,
    queryFn: async ({ signal }) => {
      if (!valid || !selection) throw new PetAdminBookingApiError(0, null);
      const value = await petAdminBookingService.obtenerDisponibilidad(selection, { signal });
      if (value.fecha !== selection.fecha) throw new PetAdminBookingApiError(200, null);
      return value;
    },
  });
}

export function petAdminCreationMutation(): MutationObserverOptions<PetAdminCreatedBooking, Error, PetAdminCreateBookingInput> {
  return { mutationKey: queryKeys.petAdminBooking.creation(), retry: false, gcTime: 0,
    mutationFn: async input => {
      const value = await petAdminBookingService.crearTurno(input);
      if (value.mascotaId !== input.mascotaId || value.clienteId !== input.clienteId || value.servicioId !== input.servicioId
        || value.fecha !== input.fecha || value.hora !== input.hora) throw new PetAdminBookingApiError(201, null);
      return value;
    } };
}

export function invalidatePetAdminBookingAfterCreation(client: QueryClient, input: PetAdminAvailabilityInput) {
  // All PET availability may be affected: PET is one team, even for another pet's cached selection.
  return Promise.allSettled([
    client.invalidateQueries({ queryKey: queryKeys.petTurnos.all }),
    client.invalidateQueries({ queryKey: queryKeys.petTurnoDisponibilidad.all }),
    client.invalidateQueries({ queryKey: petAdminAvailabilityQuery(input).queryKey, exact: true, refetchType: "none" }),
    client.invalidateQueries({ queryKey: queryKeys.petAdminBooking.availabilityAll, refetchType: "none" }),
  ]);
}

export function petAdminBookingErrorKind(error: unknown) {
  if (!(error instanceof PetAdminBookingApiError)) return "other";
  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  const code = error.code;
  if (error.status === 409 && code === "PET_SLOT_UNAVAILABLE") return "slot-conflict";
  if ((error.status === 404 && code === "PET_MASCOTA_NOT_FOUND") || (error.status === 409 && code === "PET_MASCOTA_INACTIVA")) return "mascota-stale";
  if ((error.status === 404 && code === "PET_CLIENTE_NOT_FOUND") || (error.status === 409 && code === "PET_RESPONSABLE_NO_ASOCIADO")) return "responsable-stale";
  if ((error.status === 404 && code === "PET_SERVICIO_NOT_FOUND") || (error.status === 409 && (code === "PET_SERVICIO_INACTIVO" || code === "PET_SERVICIO_NO_ASOCIADO"))) return "servicio-stale";
  if ((error.status === 404 && code === "PET_EXTRA_NOT_FOUND") || (error.status === 409 && (code === "PET_EXTRA_INACTIVO" || code === "PET_EXTRA_NO_ASOCIADO"))) return "extra-stale";
  return "other";
}
