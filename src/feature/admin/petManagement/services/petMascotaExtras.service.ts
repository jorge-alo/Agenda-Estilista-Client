import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { PetExtrasApiError } from "../../petExtras/services/petExtras.service.ts";
import { petExtraEnteroValido, type PetMascotaExtra } from "../types/petMascotaExtras.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

async function request(mascotaId: number, extraId: number | null, method: string, body?: object, signal?: AbortSignal) {
  if (!petExtraEnteroValido(mascotaId) || (extraId !== null && !petExtraEnteroValido(extraId))) throw new PetExtrasApiError(400);
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin/mascotas/${mascotaId}/extras${extraId === null ? "" : `/${extraId}`}`, {
      method, cache: "no-store", ...(signal ? { signal } : {}),
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PetExtrasApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0);
  }
  if (!response.ok) throw new PetExtrasApiError(response.status);
  return response;
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new PetExtrasApiError(response.status); }
}

function parseConfigurado(value: unknown, status: number): PetMascotaExtra {
  if (!record(value) || !petExtraEnteroValido(value.id) || typeof value.nombre !== "string"
    || (value.activo !== 0 && value.activo !== 1) || !petExtraEnteroValido(value.duracion_minutos)) {
    throw new PetExtrasApiError(status);
  }
  return { id: value.id, nombre: value.nombre, activo: value.activo, duracion_minutos: value.duracion_minutos };
}

async function write(mascotaId: number, extraId: number, duracionMinutos: number, create: boolean): Promise<void> {
  if (!petExtraEnteroValido(extraId) || !petExtraEnteroValido(duracionMinutos)) throw new PetExtrasApiError(400);
  const response = await request(mascotaId, create ? null : extraId, create ? "POST" : "PATCH",
    create ? { extraId, duracionMinutos } : { duracionMinutos });
  const value = await json(response);
  if (response.status !== (create ? 201 : 200) || !record(value) || value.id !== extraId || value.duracion_minutos !== duracionMinutos) {
    throw new PetExtrasApiError(response.status);
  }
  parseConfigurado(value, response.status);
}

export const petMascotaExtrasService = {
  async getPetMascotaExtras(mascotaId: number, signal?: AbortSignal): Promise<PetMascotaExtra[]> {
    const response = await request(mascotaId, null, "GET", undefined, signal);
    const body = await json(response);
    if (!Array.isArray(body)) throw new PetExtrasApiError(response.status);
    const ids = new Set<number>();
    return body.map((value: unknown) => {
      const extra = parseConfigurado(value, response.status);
      if (ids.has(extra.id)) throw new PetExtrasApiError(response.status);
      ids.add(extra.id);
      return extra;
    });
  },
  addPetMascotaExtra: (mascotaId: number, payload: { extraId: number; duracionMinutos: number }) =>
    write(mascotaId, payload.extraId, payload.duracionMinutos, true),
  updatePetMascotaExtra: (mascotaId: number, extraId: number, payload: { duracionMinutos: number }) =>
    write(mascotaId, extraId, payload.duracionMinutos, false),
  async removePetMascotaExtra(mascotaId: number, extraId: number): Promise<void> {
    const response = await request(mascotaId, extraId, "DELETE");
    if (response.status !== 204) throw new PetExtrasApiError(response.status);
  },
};
