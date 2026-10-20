export interface PetServicio {
  id: number;
  nombre: string;
  activo: number;
}

export type PetServicioWrite = { nombre: string } | { activo: boolean };

export function normalizePetServicioNombre(value: string): string {
  return value.trim();
}

export function validatePetServicioNombre(value: string): string | null {
  const nombre = normalizePetServicioNombre(value);
  if (!nombre) return "Ingresá el nombre del servicio.";
  if (nombre.length > 100) return "Usá hasta 100 caracteres.";
  return null;
}
