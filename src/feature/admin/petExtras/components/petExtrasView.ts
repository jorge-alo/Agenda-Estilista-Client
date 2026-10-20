import { PetExtrasApiError } from "../services/petExtras.service.ts";
import type { PetExtra } from "../types/petExtras.types.ts";

export type PetExtrasCatalogState = "loading" | "error" | "empty" | "list";

export function petExtrasCatalogState(input: {
  isLoading: boolean;
  isError: boolean;
  data: PetExtra[] | undefined;
}): PetExtrasCatalogState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.data?.length ? "list" : "empty";
}

export function petExtraStatus(active: number): { label: "Activo" | "Inactivo"; action: "Desactivar" | "Activar" } {
  return active === 1 ? { label: "Activo", action: "Desactivar" } : { label: "Inactivo", action: "Activar" };
}

export function petExtrasErrorMessage(error: unknown): string {
  if (!(error instanceof PetExtrasApiError)) return "Ocurrió un error. Intentá nuevamente.";
  if (error.status === 400) return "Revisá el nombre ingresado e intentá nuevamente.";
  if (error.status === 401) return "Tu sesión expiró. Iniciá sesión nuevamente.";
  if (error.status === 403) return "No tenés permisos para administrar los extras PET de este local.";
  if (error.status === 404) return "Este extra ya no está disponible. Actualizamos el catálogo.";
  if (error.status === 409) return "Ya existe un extra con ese nombre en tu local";
  return "No pudimos completar la operación. Intentá nuevamente.";
}
