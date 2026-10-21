import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { petManagementValidId } from "../state/petManagementState.ts";
import { MASCOTA_FLAGS, type MascotaFlagChange } from "../types/petMascotaFlags.types.ts";
import { PetManagementApiError } from "./petManagement.service.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const CODES = new Set(["PET_MASCOTA_NOT_FOUND", "PET_MASCOTA_INACTIVE", "PET_MASCOTA_RESERVA_ONLINE_CONFLICT",
  "PET_ONLINE_REQUIRES_RESPONSIBLE", "PET_ONLINE_REQUIRES_SERVICE", "PET_ONLINE_REQUIRES_HIGH_DEMAND_SETTINGS"]);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export const petMascotaFlagsService = {
  async update(mascotaId: number, change: MascotaFlagChange): Promise<void> {
    if (!petManagementValidId(mascotaId) || !MASCOTA_FLAGS.includes(change.flag) || typeof change.value !== "boolean") throw new PetManagementApiError(400, null);
    const online = change.flag === "reservaOnlineHabilitada";
    const path = `/mascotas/${mascotaId}${online ? "/reserva-online" : ""}`;
    let response: Response;
    try {
      response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ [change.flag]: change.value }),
      });
    } catch (error: unknown) {
      throw new PetManagementApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0, null);
    }
    let value: unknown;
    try { value = await response.json(); } catch { value = null; }
    if (!response.ok) {
      const code = record(value) && typeof value.error === "string" && CODES.has(value.error) ? value.error : null;
      throw new PetManagementApiError(response.status, code);
    }
    const responseField = online ? "reservaOnlineHabilitada" : change.flag === "activo" ? "activo" : "alta_exigencia";
    const expected = online ? change.value : change.value ? 1 : 0;
    if (response.status !== 200 || !record(value) || value.id !== mascotaId || value[responseField] !== expected) {
      throw new PetManagementApiError(response.status, null);
    }
    // A PATCH response is only an acknowledgement, never a replacement detail DTO.
  },
};
