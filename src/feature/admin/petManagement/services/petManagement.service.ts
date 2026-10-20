import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { mascotaBirthDateValid, mascotaWriteBody, type MascotaData, type MascotaDataPatch } from "../forms/petMascotaForm.ts";
import {
  PET_MANAGEMENT_SEARCH_LIMIT,
  type PetManagementDetail,
  type PetManagementResponsable,
  type PetManagementSearchInput,
  type PetManagementSearchResult,
} from "../types/petManagement.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const INT_MAX = 2147483647;
const ERROR_CODES = new Set(["PET_MASCOTA_SEARCH_INVALID"]);

export class PetManagementApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null) {
    super("PET_MANAGEMENT_API_ERROR");
    this.name = "PetManagementApiError";
    this.status = status;
    this.code = code;
  }
}

interface ReadOptions {
  signal?: AbortSignal;
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function idValido(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= INT_MAX;
}

function banderaDb(value: unknown): boolean | null {
  if (value === 0) return false;
  if (value === 1) return true;
  return null;
}

function fechaValida(value: unknown): value is string {
  return typeof value === "string" && mascotaBirthDateValid(value);
}

function textoNullable(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseResponsables(value: unknown): PetManagementResponsable[] | null {
  if (!Array.isArray(value)) return null;
  const responsables: PetManagementResponsable[] = [];
  for (const item of value) {
    if (!esRegistro(item) || !idValido(item.id)
      || typeof item.nombre !== "string" || typeof item.telefono !== "string") return null;
    responsables.push({ id: item.id, nombre: item.nombre, telefono: item.telefono });
  }
  return responsables;
}

function parseSearchResult(value: unknown): PetManagementSearchResult | null {
  if (!esRegistro(value) || !idValido(value.id) || typeof value.nombre !== "string"
    || !textoNullable(value.raza)) return null;
  const activo = banderaDb(value.activo);
  const responsables = parseResponsables(value.responsables);
  if (activo === null || responsables === null) return null;
  return { id: value.id, nombre: value.nombre, raza: value.raza, activo, responsables };
}

function parseSearchResults(value: unknown): PetManagementSearchResult[] | null {
  if (!Array.isArray(value)) return null;
  const results: PetManagementSearchResult[] = [];
  for (const item of value) {
    const result = parseSearchResult(item);
    if (!result) return null;
    results.push(result);
  }
  return results;
}

function parseDetail(value: unknown): PetManagementDetail | null {
  if (!esRegistro(value) || !idValido(value.id) || typeof value.nombre !== "string"
    || !textoNullable(value.raza) || !textoNullable(value.fecha_nacimiento)
    || !textoNullable(value.sexo) || !textoNullable(value.tamano) || !textoNullable(value.tipo_pelo)
    || !textoNullable(value.observaciones)
    || (value.fecha_nacimiento !== null && !fechaValida(value.fecha_nacimiento))) return null;
  const activo = banderaDb(value.activo);
  const altaExigencia = banderaDb(value.alta_exigencia);
  const reservaOnlineHabilitada = banderaDb(value.reserva_online_habilitada);
  const responsables = parseResponsables(value.responsables);
  if (activo === null || altaExigencia === null || reservaOnlineHabilitada === null || responsables === null) return null;
  return {
    id: value.id,
    nombre: value.nombre,
    raza: value.raza,
    fechaNacimiento: value.fecha_nacimiento,
    sexo: value.sexo,
    tamano: value.tamano,
    tipoPelo: value.tipo_pelo,
    observaciones: value.observaciones,
    activo,
    altaExigencia,
    reservaOnlineHabilitada,
    responsables,
  };
}

function parsearCodigo(value: unknown): string | null {
  if (!esRegistro(value) || typeof value.code !== "string" || !ERROR_CODES.has(value.code)) return null;
  return value.code;
}

async function errorHttp(response: Response): Promise<PetManagementApiError> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  return new PetManagementApiError(response.status, parsearCodigo(body));
}

async function respuestaJson<T>(
  path: string,
  parse: (value: unknown) => T | null,
  options: ReadOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
      method: "GET",
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error: unknown) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    if (error instanceof Error && error.message === "Sesión expirada") {
      throw new PetManagementApiError(401, null);
    }
    throw new PetManagementApiError(0, null);
  }
  if (!response.ok) throw await errorHttp(response);
  let body: unknown;
  try { body = await response.json(); } catch { throw new PetManagementApiError(response.status, null); }
  const parsed = parse(body);
  if (parsed === null) throw new PetManagementApiError(response.status, null);
  return parsed;
}

async function escribirDatos(path: string, method: "POST" | "PATCH", input: MascotaDataPatch): Promise<{ id: number }> {
  const body = mascotaWriteBody(input);
  if (Object.keys(body).length === 0) throw new PetManagementApiError(400, null);
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
      method, headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Sesión expirada") throw new PetManagementApiError(401, null);
    throw new PetManagementApiError(0, null);
  }
  if (!response.ok) throw await errorHttp(response);
  let value: unknown;
  try { value = await response.json(); } catch { throw new PetManagementApiError(response.status, null); }
  if (response.status !== (method === "POST" ? 201 : 200) || !esRegistro(value) || !idValido(value.id)) {
    throw new PetManagementApiError(response.status, null);
  }
  return { id: value.id };
}

export const petManagementService = {
  createMascota(data: MascotaData): Promise<{ id: number }> {
    return escribirDatos("/mascotas", "POST", data);
  },

  async updateMascotaData(mascotaId: number, patch: MascotaDataPatch): Promise<{ id: number }> {
    if (!idValido(mascotaId)) throw new PetManagementApiError(400, null);
    const result = await escribirDatos(`/mascotas/${encodeURIComponent(String(mascotaId))}`, "PATCH", patch);
    if (result.id !== mascotaId) throw new PetManagementApiError(200, null);
    return result;
  },

  buscarMascotas(input: PetManagementSearchInput): Promise<PetManagementSearchResult[]> {
    const query = new URLSearchParams({
      q: input.q,
      limit: String(input.limit ?? PET_MANAGEMENT_SEARCH_LIMIT),
      estado: input.estado,
    });
    return respuestaJson(`/mascotas/search?${query.toString()}`, parseSearchResults, {
      ...(input.signal ? { signal: input.signal } : {}),
    });
  },

  obtenerMascota(mascotaId: number, options: ReadOptions = {}): Promise<PetManagementDetail> {
    return respuestaJson(`/mascotas/${encodeURIComponent(String(mascotaId))}`, parseDetail, options);
  },
};
