import { PetServiciosApiError } from "../services/petServicios.service.ts";
import type { PetServicio } from "../types/petServicios.types.ts";

export type PetServiciosCatalogState = "loading" | "error" | "empty" | "list";

export function petServiciosCatalogState(input: {
  isLoading: boolean;
  isError: boolean;
  data: PetServicio[] | undefined;
}): PetServiciosCatalogState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.data?.length ? "list" : "empty";
}

export function petServicioStatus(active: number): { label: "Activo" | "Inactivo"; action: "Desactivar" | "Activar" } {
  return active === 1 ? { label: "Activo", action: "Desactivar" } : { label: "Inactivo", action: "Activar" };
}

export function petServiciosErrorMessage(error: unknown): string {
  if (!(error instanceof PetServiciosApiError)) return "Ocurrió un error. Intentá nuevamente.";
  if (error.status === 400) return "Revisá el nombre ingresado e intentá nuevamente.";
  if (error.status === 401) return "Tu sesión expiró. Iniciá sesión nuevamente.";
  if (error.status === 403) return "No tenés permisos para administrar los servicios PET de este local.";
  if (error.status === 404) return "Este servicio ya no está disponible. Actualizamos el catálogo.";
  return "No pudimos completar la operación. Intentá nuevamente.";
}
