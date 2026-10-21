import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { parsePetSolicitudes, parsePetSolicitudConversion, type PetSolicitud, type PetSolicitudConversionInput, type PetSolicitudConversionResult, type PetSolicitudEstado } from "../types/petSolicitudes.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
export class PetSolicitudesApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) { super("PET_SOLICITUDES_API_ERROR"); this.name = "PetSolicitudesApiError"; this.status = status; this.code = code; }
}
async function request(path: string, init: RequestInit, expectedStatus: number): Promise<unknown> {
  let response: Response;
  try { response = await fetchWithAuth(`${API_URL}/api/pet/admin/solicitudes${path}`, { cache: "no-store", ...init }); }
  catch (error) { if (error instanceof Error && error.message === "Sesión expirada") throw new PetSolicitudesApiError(401, null); throw new PetSolicitudesApiError(0, null); }
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const payload = body !== null && typeof body === "object" ? body as Record<string, unknown> : null;
    const domainCode = typeof payload?.code === "string" ? payload.code : typeof payload?.error === "string" ? payload.error : null;
    throw new PetSolicitudesApiError(response.status, domainCode);
  }
  if (response.status !== expectedStatus) throw new PetSolicitudesApiError(response.status, null);
  return body;
}
export const petSolicitudesService = {
  async list(estado: PetSolicitudEstado | null, signal?: AbortSignal): Promise<PetSolicitud[]> {
    const value = await request(estado ? `?estado=${encodeURIComponent(estado)}` : "", { method: "GET", ...(signal ? { signal } : {}) }, 200);
    const parsed = parsePetSolicitudes(value); if (!parsed) throw new PetSolicitudesApiError(200, null); return parsed;
  },
  async changeState(id: number, estado: "CONTACTADA" | "DESCARTADA"): Promise<void> {
    await request(`/${encodeURIComponent(String(id))}/estado`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) }, 200);
  },
  async convert(id: number, input: PetSolicitudConversionInput): Promise<PetSolicitudConversionResult> {
    const value = await request(`/${encodeURIComponent(String(id))}/convertir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, 201);
    const parsed = parsePetSolicitudConversion(value); if (!parsed) throw new PetSolicitudesApiError(201, null); return parsed;
  },
};
