import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { petBloqueoFechaValida } from "../types/petBloqueos.types.ts";
import type { PetBloqueo, PetBloqueoWrite } from "../types/petBloqueos.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const BASE = "/api/pet/admin/bloqueos";

export class PetBloqueosApiError extends Error {
  readonly status: number;
  constructor(status: number) { super("PET_BLOQUEOS_API_ERROR"); this.name = "PetBloqueosApiError"; this.status = status; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseBloqueo(value: unknown): PetBloqueo | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1
    || typeof value.fecha !== "string" || !petBloqueoFechaValida(value.fecha)
    || !(value.hora_inicio === null || typeof value.hora_inicio === "string")
    || !(value.hora_fin === null || typeof value.hora_fin === "string")
    || !(value.motivo === null || typeof value.motivo === "string")
    || (value.es_dia_completo !== 0 && value.es_dia_completo !== 1)
    || (value.es_dia_completo === 1 && (value.hora_inicio !== null || value.hora_fin !== null))
    || (value.es_dia_completo === 0 && (typeof value.hora_inicio !== "string" || typeof value.hora_fin !== "string"))) return null;
  return { id: value.id as number, fecha: value.fecha, hora_inicio: value.hora_inicio as string | null,
    hora_fin: value.hora_fin as string | null, motivo: value.motivo as string | null, es_dia_completo: value.es_dia_completo };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try { return await fetchWithAuth(`${API_URL}${BASE}${path}`, { cache: "no-store", ...init }); }
  catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PetBloqueosApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0);
  }
}

async function parseResponse(response: Response): Promise<PetBloqueo> {
  const body = await response.json().catch(() => null);
  const record = parseBloqueo(body);
  if (!record) throw new PetBloqueosApiError(response.status);
  return record;
}

export const petBloqueosService = {
  async get(signal?: AbortSignal): Promise<PetBloqueo[]> {
    const response = await request("", { method: "GET", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new PetBloqueosApiError(response.status);
    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) throw new PetBloqueosApiError(response.status);
    const records = body.map(parseBloqueo);
    if (records.some(record => record === null)) throw new PetBloqueosApiError(response.status);
    return records as PetBloqueo[];
  },
  async create(payload: PetBloqueoWrite): Promise<PetBloqueo> {
    const response = await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new PetBloqueosApiError(response.status);
    if (response.status !== 201) throw new PetBloqueosApiError(response.status);
    return parseResponse(response);
  },
  async update(id: number, payload: PetBloqueoWrite): Promise<PetBloqueo> {
    if (!Number.isSafeInteger(id) || id < 1 || !Object.keys(payload).length) throw new PetBloqueosApiError(400);
    const response = await request(`/${encodeURIComponent(String(id))}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new PetBloqueosApiError(response.status);
    if (response.status !== 200) throw new PetBloqueosApiError(response.status);
    const record = await parseResponse(response);
    if (record.id !== id) throw new PetBloqueosApiError(response.status);
    return record;
  },
  async remove(id: number): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1) throw new PetBloqueosApiError(400);
    const response = await request(`/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    if (response.status !== 204) throw new PetBloqueosApiError(response.status);
  },
};
