import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { PetServiciosApiError } from "../../petServicios/services/petServicios.service.ts";
import { petServicioEnteroValido, type PetMascotaServicio } from "../types/petMascotaServicios.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

async function request(mascotaId: number, servicioId: number | null, method: string, body?: object, signal?: AbortSignal) {
  if (!petServicioEnteroValido(mascotaId) || (servicioId !== null && !petServicioEnteroValido(servicioId))) throw new PetServiciosApiError(400);
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin/mascotas/${mascotaId}/servicios${servicioId === null ? "" : `/${servicioId}`}`, {
      method, cache: "no-store", ...(signal ? { signal } : {}),
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PetServiciosApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0);
  }
  if (!response.ok) throw new PetServiciosApiError(response.status);
  return response;
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new PetServiciosApiError(response.status); }
}

async function write(mascotaId: number, servicioId: number, duracionMinutos: number, create: boolean): Promise<void> {
  if (!petServicioEnteroValido(servicioId) || !petServicioEnteroValido(duracionMinutos)) throw new PetServiciosApiError(400);
  const response = await request(mascotaId, create ? null : servicioId, create ? "POST" : "PATCH",
    create ? { servicioId, duracionMinutos } : { duracionMinutos });
  const value = await json(response);
  if (response.status !== (create ? 201 : 200) || !record(value) || value.servicioId !== servicioId || value.duracion_minutos !== duracionMinutos) {
    throw new PetServiciosApiError(response.status);
  }
}

export const petMascotaServiciosService = {
  async getPetMascotaServicios(mascotaId: number, signal?: AbortSignal): Promise<PetMascotaServicio[]> {
    const response = await request(mascotaId, null, "GET", undefined, signal);
    const body = await json(response);
    if (!Array.isArray(body)) throw new PetServiciosApiError(response.status);
    const ids = new Set<number>();
    return body.map((value: unknown) => {
      if (!record(value) || !petServicioEnteroValido(value.id) || typeof value.nombre !== "string"
        || (value.activo !== 0 && value.activo !== 1 && value.activo !== null)
        || !petServicioEnteroValido(value.duracion_minutos) || ids.has(value.id)) throw new PetServiciosApiError(response.status);
      ids.add(value.id);
      // The relationship GET returns raw nullable legacy activo; NULL is never reservable.
      return { id: value.id, nombre: value.nombre, activo: value.activo === 1 ? 1 : 0, duracion_minutos: value.duracion_minutos };
    });
  },
  addPetMascotaServicio: (mascotaId: number, payload: { servicioId: number; duracionMinutos: number }) =>
    write(mascotaId, payload.servicioId, payload.duracionMinutos, true),
  updatePetMascotaServicio: (mascotaId: number, servicioId: number, payload: { duracionMinutos: number }) =>
    write(mascotaId, servicioId, payload.duracionMinutos, false),
  async removePetMascotaServicio(mascotaId: number, servicioId: number): Promise<void> {
    const response = await request(mascotaId, servicioId, "DELETE");
    if (response.status !== 204) throw new PetServiciosApiError(response.status);
  },
};
