import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import type { PetServicio, PetServicioWrite } from "../types/petServicios.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const INT_MAX = 2147483647;

export class PetServiciosApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super("PET_SERVICIOS_API_ERROR");
    this.name = "PetServiciosApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= INT_MAX;
}

function parseServicio(value: unknown): PetServicio | null {
  if (!isRecord(value) || !validId(value.id) || typeof value.nombre !== "string"
    || (value.activo !== 0 && value.activo !== 1)) return null;
  return { id: value.id, nombre: value.nombre, activo: value.activo };
}

async function httpError(response: Response): Promise<PetServiciosApiError> {
  let code: string | null = null;
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.code === "string") code = body.code;
  } catch { /* El status es suficiente para clasificar el error. */ }
  return new PetServiciosApiError(response.status, code);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetchWithAuth(`${API_URL}/api/pet/admin/servicios${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.message === "Sesión expirada") {
      throw new PetServiciosApiError(401);
    }
    throw new PetServiciosApiError(0);
  }
}

export const petServiciosService = {
  async getPetServicios(signal?: AbortSignal): Promise<PetServicio[]> {
    const response = await request("", { method: "GET", ...(signal ? { signal } : {}) });
    if (!response.ok) throw await httpError(response);
    let body: unknown;
    try { body = await response.json(); } catch { throw new PetServiciosApiError(response.status); }
    if (!Array.isArray(body)) throw new PetServiciosApiError(response.status);
    const servicios: PetServicio[] = [];
    for (const item of body) {
      const servicio = parseServicio(item);
      if (!servicio) throw new PetServiciosApiError(response.status);
      servicios.push(servicio);
    }
    return servicios;
  },

  async createPetServicio(input: { nombre: string }): Promise<PetServicio> {
    const nombre = typeof input?.nombre === "string" ? input.nombre.trim() : "";
    if (nombre.length < 1 || nombre.length > 100) throw new PetServiciosApiError(400);
    const response = await request("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!response.ok) throw await httpError(response);
    let body: unknown;
    try { body = await response.json(); } catch { throw new PetServiciosApiError(response.status); }
    const servicio = parseServicio(body);
    if (response.status !== 201 || !servicio) throw new PetServiciosApiError(response.status);
    return servicio;
  },

  async updatePetServicio(servicioId: number, payload: PetServicioWrite): Promise<PetServicio> {
    if (!validId(servicioId) || !isRecord(payload)) throw new PetServiciosApiError(400);
    let body: { nombre?: string; activo?: boolean };
    if (Object.keys(payload).length === 1 && "nombre" in payload && typeof payload.nombre === "string") {
      const nombre = payload.nombre.trim();
      if (!nombre || nombre.length > 100) throw new PetServiciosApiError(400);
      body = { nombre };
    } else if (Object.keys(payload).length === 1 && "activo" in payload && typeof payload.activo === "boolean") {
      body = { activo: payload.activo };
    } else {
      throw new PetServiciosApiError(400);
    }
    const response = await request(`/${encodeURIComponent(String(servicioId))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await httpError(response);
    let value: unknown;
    try { value = await response.json(); } catch { throw new PetServiciosApiError(response.status); }
    const servicio = parseServicio(value);
    if (response.status !== 200 || !servicio || servicio.id !== servicioId) {
      throw new PetServiciosApiError(response.status);
    }
    return servicio;
  },
};
