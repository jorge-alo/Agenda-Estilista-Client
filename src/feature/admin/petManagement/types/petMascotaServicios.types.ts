import type { PetServicio } from "../../petServicios/types/petServicios.types.ts";

export interface PetMascotaServicio {
  id: number;
  nombre: string;
  activo: 0 | 1;
  duracion_minutos: number;
}

export const PET_DURACION_MAX = 2147483647;
export const petServicioEnteroValido = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= PET_DURACION_MAX;

/** Accept decimal digits only: never silently interpret exponent, sign, whitespace or fractions. */
export function parsePetDuracion(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return petServicioEnteroValido(number) ? number : null;
}

export function combinePetMascotaServicios(catalogo: readonly PetServicio[], relaciones: readonly PetMascotaServicio[]) {
  const byId = new Map(relaciones.map(item => [item.id, item]));
  const catalogIds = new Set(catalogo.map(item => item.id));
  // Preserve backend catalog order. A relationship absent from a stale catalog remains visible.
  return [...catalogo, ...relaciones.filter(item => !catalogIds.has(item.id))].map(servicio => {
    const relacion = byId.get(servicio.id);
    return {
      id: servicio.id, nombre: servicio.nombre,
      activo: servicio.activo === 1 && (!relacion || relacion.activo === 1),
      permitido: relacion !== undefined,
      duracionMinutos: relacion?.duracion_minutos ?? null,
    };
  });
}

export function petMascotaServiciosError(error: unknown): string {
  const status = error !== null && typeof error === "object" && "status" in error ? error.status : 0;
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos para gestionar los servicios de esta mascota.";
  if (status === 404) return "La mascota, el servicio o la relación ya no están disponibles. Actualizá los servicios.";
  if (status === 409) return "El servicio está inactivo o ya está asociado. Revisá la configuración actualizada.";
  if (status === 400) return "Revisá la duración: debe ser un entero entre 1 y 2147483647 min.";
  return "No pudimos consultar los servicios. Intentá nuevamente.";
}

export const petMascotaServicioRemoveConfirmation = (nombre: string) =>
  `¿Quitar ${nombre} de esta mascota? La configuración de duración para esta mascota se eliminará. El servicio seguirá existiendo en el catálogo del local.`;
