export const PET_MANAGEMENT_ESTADOS = ["todas", "activas", "inactivas"] as const;

export type PetManagementEstado = (typeof PET_MANAGEMENT_ESTADOS)[number];

export const PET_MANAGEMENT_SEARCH_LIMIT = 20;
export const PET_MANAGEMENT_SEARCH_DEBOUNCE_MS = 300;
export const PET_MANAGEMENT_SEARCH_MIN_LENGTH = 2;
export const PET_MANAGEMENT_SEARCH_MAX_LENGTH = 100;

export interface PetManagementResponsable {
  id: number;
  nombre: string;
  telefono: string;
}

export interface PetManagementSearchResult {
  id: number;
  nombre: string;
  raza: string | null;
  activo: boolean;
  responsables: PetManagementResponsable[];
}

export interface PetManagementDetail {
  id: number;
  nombre: string;
  raza: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  tamano: string | null;
  tipoPelo: string | null;
  observaciones: string | null;
  activo: boolean;
  altaExigencia: boolean;
  reservaOnlineHabilitada: boolean;
  responsables: PetManagementResponsable[];
}

export interface PetManagementSearchInput {
  q: string;
  estado: PetManagementEstado;
  limit?: number;
  signal?: AbortSignal;
}
