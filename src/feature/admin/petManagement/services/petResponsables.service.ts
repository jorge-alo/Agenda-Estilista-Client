import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { PetManagementApiError } from "./petManagement.service.ts";
import { petManagementValidId } from "../state/petManagementState.ts";
import { normalizeResponsableDraft, type ResponsableDraft } from "../forms/petResponsableForm.ts";
import type { PetManagementResponsable } from "../types/petManagement.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const PHONE_CODES = new Set(["CLIENT_PHONE_INVALID", "CLIENT_PHONE_CONFLICT"]);
export type ConfirmedResponsable = PetManagementResponsable & { isNew: boolean };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

async function write(path: string, method: "POST" | "DELETE", body?: object): Promise<Response> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
      method, cache: "no-store",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch (error: unknown) {
    throw new PetManagementApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0, null);
  }
  if (!response.ok) {
    const value = await readJson(response);
    const code = record(value) && typeof value.error === "string" && PHONE_CODES.has(value.error) ? value.error : null;
    throw new PetManagementApiError(response.status, code);
  }
  return response;
}

async function relationWrite(path: string, method: "POST" | "DELETE", body?: { clienteId: number }): Promise<void> {
  const response = await write(path, method, body);
  const value = await readJson(response);
  if (response.status !== (method === "POST" ? 201 : 200) || !record(value) || typeof value.message !== "string") {
    throw new PetManagementApiError(response.status, null);
  }
}

export const petResponsablesService = {
  async createResponsable(draft: ResponsableDraft): Promise<ConfirmedResponsable> {
    const response = await write("/responsables", "POST", normalizeResponsableDraft(draft));
    const value = await readJson(response);
    if (!record(value) || typeof value.id !== "number" || !petManagementValidId(value.id) || typeof value.nombre !== "string"
      || typeof value.telefono !== "string" || typeof value.isNew !== "boolean"
      || response.status !== (value.isNew ? 201 : 200)) {
      throw new PetManagementApiError(response.status, null);
    }
    return { id: value.id, nombre: value.nombre, telefono: value.telefono, isNew: value.isNew };
  },

  associateResponsable(mascotaId: number, clienteId: number): Promise<void> {
    if (!petManagementValidId(mascotaId) || !petManagementValidId(clienteId)) return Promise.reject(new PetManagementApiError(400, null));
    return relationWrite(`/mascotas/${mascotaId}/responsables`, "POST", { clienteId });
  },

  removeResponsable(mascotaId: number, clienteId: number): Promise<void> {
    if (!petManagementValidId(mascotaId) || !petManagementValidId(clienteId)) return Promise.reject(new PetManagementApiError(400, null));
    return relationWrite(`/mascotas/${mascotaId}/responsables/${clienteId}`, "DELETE");
  },
};
