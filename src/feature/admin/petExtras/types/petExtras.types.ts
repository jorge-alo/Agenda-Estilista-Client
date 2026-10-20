export interface PetExtra {
  id: number;
  nombre: string;
  activo: 0 | 1;
}

export type PetExtraWrite = { nombre: string } | { activo: boolean };

export function normalizePetExtraNombre(value: string): string {
  return value.trim();
}

export function validatePetExtraNombre(value: string): string | null {
  const nombre = normalizePetExtraNombre(value);
  if (!nombre) return "Ingresá el nombre del extra.";
  if ([...nombre].length > 100) return "Usá hasta 100 caracteres.";
  return null;
}
