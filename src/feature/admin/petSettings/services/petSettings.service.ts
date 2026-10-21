import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import { parsePetSettingsValue } from "../types/petSettings.types.ts";
import type { PetSettings, PetSettingsWrite } from "../types/petSettings.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const URL = `${API_URL}/api/pet/admin/settings`;

export class PetSettingsApiError extends Error {
  readonly status: number;
  constructor(status: number) { super("PET_SETTINGS_API_ERROR"); this.name = "PetSettingsApiError"; this.status = status; }
}

async function request(init: RequestInit): Promise<Response> {
  try { return await fetchWithAuth(URL, { cache: "no-store", ...init }); }
  catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PetSettingsApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0);
  }
}

async function parseResponse(response: Response): Promise<PetSettings> {
  if (!response.ok) throw new PetSettingsApiError(response.status);
  const settings = parsePetSettingsValue(await response.json().catch(() => null));
  if (!settings) throw new PetSettingsApiError(response.status);
  return settings;
}

export const petSettingsService = {
  async get(signal?: AbortSignal): Promise<PetSettings> {
    return parseResponse(await request({ method: "GET", ...(signal ? { signal } : {}) }));
  },
  async replace(write: PetSettingsWrite): Promise<PetSettings> {
    const response = await request({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(write) });
    const settings = await parseResponse(response);
    if (response.status !== 200) throw new PetSettingsApiError(response.status);
    return settings;
  },
};
