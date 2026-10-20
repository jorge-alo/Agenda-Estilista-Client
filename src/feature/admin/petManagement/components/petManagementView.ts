import { PetManagementApiError } from "../services/petManagement.service.ts";
import type { PetManagementSearchResult } from "../types/petManagement.types.ts";

export type PetManagementReadSource = "search" | "detail";

export type PetManagementErrorKind =
  | "search-invalid"
  | "detail-not-found"
  | "unauthorized"
  | "forbidden"
  | "protocol"
  | "read-error";

export const PET_MANAGEMENT_EMPTY_SEARCH_MESSAGE = "No encontramos mascotas con esa búsqueda.";
export const PET_MANAGEMENT_TOO_SHORT_MESSAGE = "Escribí al menos 2 caracteres para buscar.";
export const PET_MANAGEMENT_TOO_LONG_MESSAGE = "La búsqueda admite hasta 100 caracteres.";
export const PET_MANAGEMENT_INITIAL_MESSAGE = "Ingresá al menos 2 caracteres para buscar una mascota.";
export const PET_MANAGEMENT_LIMIT_MESSAGE =
  "Se muestran hasta 20 resultados. Refiná la búsqueda para encontrar una mascota específica.";
export const PET_MANAGEMENT_UNAVAILABLE_MESSAGE = "La mascota ya no está disponible.";

export function petManagementErrorKind(
  error: unknown,
  source: PetManagementReadSource,
): PetManagementErrorKind {
  if (!(error instanceof PetManagementApiError)) return "read-error";
  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  if (error.status === 200) return "protocol";
  if (source === "detail" && error.status === 404) return "detail-not-found";
  if (source === "search" && error.status === 400 && error.code === "PET_MASCOTA_SEARCH_INVALID") {
    return "search-invalid";
  }
  return "read-error";
}

export function petManagementSearchErrorMessage(kind: PetManagementErrorKind | null): string | null {
  switch (kind) {
    case null: return null;
    case "search-invalid": return "No pudimos validar la búsqueda. Revisá el término e intentá nuevamente.";
    case "unauthorized": return "La sesión finalizó. Iniciá sesión nuevamente.";
    case "forbidden": return "No tenés permisos para consultar mascotas.";
    case "protocol": return "Recibimos una respuesta inesperada. Intentá nuevamente.";
    case "detail-not-found": return PET_MANAGEMENT_UNAVAILABLE_MESSAGE;
    case "read-error": return "No pudimos buscar mascotas. Intentá nuevamente.";
  }
}

export function petManagementDetailErrorMessage(kind: PetManagementErrorKind | null): string | null {
  switch (kind) {
    case null: return null;
    case "detail-not-found": return PET_MANAGEMENT_UNAVAILABLE_MESSAGE;
    case "unauthorized": return "La sesión finalizó. Iniciá sesión nuevamente.";
    case "forbidden": return "No tenés permisos para consultar esta mascota.";
    case "protocol": return "Recibimos una respuesta inesperada. Intentá nuevamente.";
    case "search-invalid": return "No pudimos cargar la ficha. Intentá nuevamente.";
    case "read-error": return "No pudimos cargar la ficha. Intentá nuevamente.";
  }
}

export function petManagementText(value: string | null): string {
  const normalized = value?.trim();
  return normalized ? normalized : "Sin datos";
}

export function petManagementDateLabel(value: string | null): string {
  if (!value) return "Sin datos";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function petManagementFlagLabel(value: boolean, positive: string, negative: string): string {
  return value ? positive : negative;
}

export function petManagementResultMeta(
  result: Pick<PetManagementSearchResult, "raza" | "responsables">,
): string {
  const raza = petManagementText(result.raza);
  const parts: string[] = [];
  if (result.responsables.length === 0) {
    parts.push("Sin responsable asociado");
  } else {
    const names = result.responsables.map(item => item.nombre.trim()).filter(Boolean);
    if (names.length === 0) {
      parts.push("Sin responsable asociado");
    } else if (names.length <= 2) {
      parts.push(...names);
    } else {
      parts.push(names[0], `${names[1]} (+${names.length - 2})`);
    }
  }
  if (raza !== "Sin datos") parts.push(raza);
  return parts.join(" · ");
}

export function petManagementShowsLimitCopy(count: number): boolean {
  return count === 20;
}
