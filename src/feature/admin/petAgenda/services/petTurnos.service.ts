import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth";
import type { ConsultaTurnosPet, TurnoPet } from "../types/petTurno.types";

const API_URL = import.meta.env.VITE_API_URL;

async function leerError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json() as { error?: string };
    return new Error(data.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export const petTurnosService = {
  async listar(consulta: ConsultaTurnosPet): Promise<TurnoPet[]> {
    const params = new URLSearchParams(consulta);
    const response = await fetchWithAuth(`${API_URL}/api/pet/admin/turnos?${params.toString()}`);
    if (!response.ok) throw await leerError(response, "No se pudo cargar la agenda PET");
    return response.json() as Promise<TurnoPet[]>;
  },

  async cancelar(id: number): Promise<{ id: number; estado: "cancelado" }> {
    const response = await fetchWithAuth(`${API_URL}/api/pet/admin/turnos/${id}/cancelar`, { method: "PATCH" });
    if (!response.ok) throw await leerError(response, "No se pudo cancelar el turno PET");
    return response.json() as Promise<{ id: number; estado: "cancelado" }>;
  },

  async completar(id: number): Promise<{ id: number; estado: "completado" }> {
    const response = await fetchWithAuth(`${API_URL}/api/pet/admin/turnos/${id}/completar`, { method: "PATCH" });
    if (!response.ok) throw await leerError(response, "No se pudo completar el turno PET");
    return response.json() as Promise<{ id: number; estado: "completado" }>;
  },
};
