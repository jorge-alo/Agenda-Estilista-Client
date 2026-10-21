import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import type { PetHorario, PetHorarioWrite } from "../types/petHorarios.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const BASE = "/api/pet/admin/horarios";

export class PetHorariosApiError extends Error {
  readonly status: number;

  constructor(status: number) { super("PET_HORARIOS_API_ERROR"); this.name = "PetHorariosApiError"; this.status = status; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseHorario(value: unknown): PetHorario | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1
    || !Number.isInteger(value.dia_semana) || Number(value.dia_semana) < 0 || Number(value.dia_semana) > 6
    || typeof value.hora_inicio !== "string" || typeof value.hora_fin !== "string"
    || (value.activo !== 0 && value.activo !== 1)) return null;
  return { id: value.id as number, dia_semana: value.dia_semana as number,
    hora_inicio: value.hora_inicio, hora_fin: value.hora_fin, activo: value.activo };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try { return await fetchWithAuth(`${API_URL}${BASE}${path}`, { cache: "no-store", ...init }); }
  catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PetHorariosApiError(error instanceof Error && error.message === "Sesión expirada" ? 401 : 0);
  }
}

export const petHorariosService = {
  async get(signal?: AbortSignal): Promise<PetHorario[]> {
    const response = await request("", { method: "GET", ...(signal ? { signal } : {}) });
    if (!response.ok) throw new PetHorariosApiError(response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new PetHorariosApiError(response.status); }
    if (!Array.isArray(body)) throw new PetHorariosApiError(response.status);
    const records = body.map(parseHorario);
    if (records.some(record => record === null)) throw new PetHorariosApiError(response.status);
    return records as PetHorario[];
  },
  async create(input: { diaSemana: number; horaInicio: string; horaFin: string }): Promise<PetHorario> {
    const response = await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) throw new PetHorariosApiError(response.status);
    const result = await response.json().catch(() => null);
    const horario = parseHorario(result);
    if (response.status !== 201 || !horario) throw new PetHorariosApiError(response.status);
    return horario;
  },
  async update(id: number, patch: PetHorarioWrite): Promise<PetHorario> {
    if (!Number.isSafeInteger(id) || id < 1 || !Object.keys(patch).length) throw new PetHorariosApiError(400);
    const response = await request(`/${encodeURIComponent(String(id))}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!response.ok) throw new PetHorariosApiError(response.status);
    const result = await response.json().catch(() => null);
    const horario = parseHorario(result);
    if (response.status !== 200 || !horario || horario.id !== id) throw new PetHorariosApiError(response.status);
    return horario;
  },
  async remove(id: number): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1) throw new PetHorariosApiError(400);
    const response = await request(`/${encodeURIComponent(String(id))}`, { method: "DELETE" });
    if (response.status !== 204) throw new PetHorariosApiError(response.status);
  },
};
