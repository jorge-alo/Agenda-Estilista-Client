export interface PetServicio {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: number;
}

export interface PetServicioWrite { nombre?: string; descripcion?: string | null; activo?: boolean }

export function normalizePetServicioDescripcion(value: string): string | null {
  return value.trim() || null;
}

export function validatePetServicioDescripcion(value: string): string | null {
  return [...value.trim()].length > 1000 ? "Usá hasta 1000 caracteres para la descripción." : null;
}

export function normalizePetServicioNombre(value: string): string {
  return value.trim();
}

export function validatePetServicioNombre(value: string): string | null {
  const nombre = normalizePetServicioNombre(value);
  if (!nombre) return "Ingresá el nombre del servicio.";
  if (nombre.length > 100) return "Usá hasta 100 caracteres.";
  return null;
}
