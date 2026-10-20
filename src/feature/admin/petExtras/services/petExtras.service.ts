import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import type { PetExtra, PetExtraWrite } from "../types/petExtras.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const INT_MAX = 2147483647;

export class PetExtrasApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("PET_EXTRAS_API_ERROR");
    this.name = "PetExtrasApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= INT_MAX;
}

function parseExtra(value: unknown): PetExtra | null {
  if (!isRecord(value) || !validId(value.id) || typeof value.nombre !== "string"
    || (value.activo !== 0 && value.activo !== 1)) return null;
  return { id: value.id, nombre: value.nombre, activo: value.activo };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetchWithAuth(`${API_URL}/api/pet/admin/extras${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof Error && error.message === "Sesión expirada") {
      throw new PetExtrasApiError(401);
    }
    throw new PetExtrasApiError(0);
  }
}

async function parseResponse(response: Response): Promise<PetExtra> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new PetExtrasApiError(response.status); }
  const extra = parseExtra(value);
  if (!extra) throw new PetExtrasApiError(response.status);
  return extra;
}

export const petExtrasService = {
  async getPetExtras(signal?: AbortSignal): Promise<PetExtra[]> {
    const response = await request("", { method: "GET", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new PetExtrasApiError(response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new PetExtrasApiError(response.status); }
    if (!Array.isArray(body)) throw new PetExtrasApiError(response.status);
    const extras: PetExtra[] = [];
    for (const item of body) {
      const extra = parseExtra(item);
      if (!extra) throw new PetExtrasApiError(response.status);
      extras.push(extra);
    }
    return extras;
  },

  async createPetExtra(input: { nombre: string }): Promise<PetExtra> {
    const nombre = typeof input?.nombre === "string" ? input.nombre.trim() : "";
    if (!nombre || [...nombre].length > 100) throw new PetExtrasApiError(400);
    const response = await request("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!response.ok) throw new PetExtrasApiError(response.status);
    const extra = await parseResponse(response);
    if (response.status !== 201) throw new PetExtrasApiError(response.status);
    return extra;
  },

  async updatePetExtra(extraId: number, payload: PetExtraWrite): Promise<PetExtra> {
    if (!validId(extraId) || !isRecord(payload)) throw new PetExtrasApiError(400);
    let body: { nombre?: string; activo?: boolean };
    if (Object.keys(payload).length === 1 && "nombre" in payload && typeof payload.nombre === "string") {
      const nombre = payload.nombre.trim();
      if (!nombre || [...nombre].length > 100) throw new PetExtrasApiError(400);
      body = { nombre };
    } else if (Object.keys(payload).length === 1 && "activo" in payload && typeof payload.activo === "boolean") {
      body = { activo: payload.activo };
    } else {
      throw new PetExtrasApiError(400);
    }
    const response = await request(`/${encodeURIComponent(String(extraId))}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new PetExtrasApiError(response.status);
    const extra = await parseResponse(response);
    if (response.status !== 200 || extra.id !== extraId) throw new PetExtrasApiError(response.status);
    return extra;
  },
};
