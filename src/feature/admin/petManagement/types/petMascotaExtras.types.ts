import type { PetExtra } from "../../petExtras/types/petExtras.types.ts";
import { parsePetDuracion, petDuracionEnteroValida } from "./petDuracion.ts";

export interface PetMascotaExtra {
  id: number;
  nombre: string;
  activo: 0 | 1;
  duracion_minutos: number;
}

export { parsePetDuracion as parsePetExtraDuracion, petDuracionEnteroValida as petExtraEnteroValido };

export function combinePetMascotaExtras(catalogo: readonly PetExtra[], relaciones: readonly PetMascotaExtra[]) {
  const byId = new Map(relaciones.map(item => [item.id, item]));
  const catalogIds = new Set(catalogo.map(item => item.id));
  // Preserve backend catalog order. A relationship absent from a stale catalog remains visible.
  return [...catalogo, ...relaciones.filter(item => !catalogIds.has(item.id))].map(extra => {
    const relacion = byId.get(extra.id);
    return {
      id: extra.id, nombre: extra.nombre,
      activo: extra.activo === 1 && (!relacion || relacion.activo === 1),
      permitido: relacion !== undefined,
      duracionAdicionalMinutos: relacion?.duracion_minutos ?? null,
    };
  });
}

export function petMascotaExtrasError(error: unknown): string {
  const status = error !== null && typeof error === "object" && "status" in error ? error.status : 0;
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos para gestionar los extras de esta mascota.";
  if (status === 404) return "La mascota, el extra o la relación ya no están disponibles. Actualizá los extras.";
  if (status === 409) return "El extra está inactivo o ya está asociado. Revisá la configuración actualizada.";
  if (status === 400) return "Revisá el tiempo adicional: debe ser un entero entre 1 y 2147483647 min.";
  return "No pudimos consultar los extras. Intentá nuevamente.";
}

export const petMascotaExtraRemoveConfirmation = (nombre: string) =>
  `¿Quitar este extra de la mascota? Se eliminará la configuración de minutos adicionales de ${nombre} para esta mascota. El extra seguirá existiendo en el catálogo del local.`;
