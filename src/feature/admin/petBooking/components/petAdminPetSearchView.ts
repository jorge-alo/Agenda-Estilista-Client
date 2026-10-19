import type { PetAdminMascotaDetail, PetAdminMascotaSearchResult } from "../types/petAdminBooking.types.ts";

export const PET_ADMIN_SEARCH_DEBOUNCE_MS = 300;
export const PET_ADMIN_SEARCH_MAX_LENGTH = 100;
export const PET_ADMIN_SEARCH_TOO_SHORT_MESSAGE = "Escribí al menos 2 caracteres.";
export const PET_ADMIN_SEARCH_EMPTY_MESSAGE = "No encontramos mascotas con esa búsqueda.";
export const PET_ADMIN_SEARCH_LIMIT_MESSAGE = "Hay varios resultados. Refiná la búsqueda para encontrar la mascota.";

export type PetAdminSearchInputState = "empty" | "too-short" | "ready";

export interface PetAdminSearchOption {
  id: number;
  nombre: string;
  detalle: string;
}

function text(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function petAdminSearchNormalizedTerm(value: string): string {
  return value.trim();
}

export function petAdminSearchRequestTerm(value: string): string | null {
  const term = petAdminSearchNormalizedTerm(value);
  return term.length < 2 || term.length > PET_ADMIN_SEARCH_MAX_LENGTH ? null : term;
}

export function petAdminSearchInputState(value: string): PetAdminSearchInputState {
  const length = petAdminSearchNormalizedTerm(value).length;
  if (length === 0) return "empty";
  return length === 1 ? "too-short" : "ready";
}

export function petAdminSearchResultMeta(result: Pick<PetAdminMascotaSearchResult, "raza" | "responsables">): string {
  const raza = text(result.raza);
  if (result.responsables.length === 0) {
    return [raza, "Sin responsable asociado"].filter((part): part is string => part !== null).join(" · ");
  }
  const names = result.responsables.map(item => item.nombre);
  if (result.responsables.length === 1) {
    return [names[0], text(result.responsables[0].telefono), raza]
      .filter((part): part is string => part !== null).join(" · ");
  }
  const visible = names.slice(0, 2);
  if (names.length > 2) visible[1] = `${visible[1]} (+${names.length - 2})`;
  return [...visible, raza].filter((part): part is string => part !== null).join(" · ");
}

export function petAdminSearchOption(result: PetAdminMascotaSearchResult): PetAdminSearchOption {
  return { id: result.id, nombre: result.nombre, detalle: petAdminSearchResultMeta(result) };
}

export function petAdminSearchOptions(results: readonly PetAdminMascotaSearchResult[]): PetAdminSearchOption[] {
  return results.map(petAdminSearchOption);
}

export function petAdminSearchSelectedRaza(detail: Pick<PetAdminMascotaDetail, "raza"> | null): string | null {
  return text(detail?.raza);
}
