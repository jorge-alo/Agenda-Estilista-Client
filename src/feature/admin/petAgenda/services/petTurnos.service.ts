import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth";
import type { ConsultaTurnosPet, PetRescheduleAvailability, TurnoPet } from "../types/petTurno.types";

const API_URL = import.meta.env.VITE_API_URL;

export class PetApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function leerError(response: Response, fallback: string): Promise<PetApiError> {
  try {
    const data = await response.json() as { error?: string; code?: string };
    return new PetApiError(data.error || fallback, response.status, data.code);
  } catch {
    return new PetApiError(fallback, response.status);
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

  async obtenerDisponibilidadReprogramacion(turnoId: number, fecha: string): Promise<PetRescheduleAvailability> {
    const params = new URLSearchParams({ fecha });
    const response = await fetchWithAuth(
      `${API_URL}/api/pet/admin/turnos/${turnoId}/disponibilidad?${params.toString()}`,
    );
    if (!response.ok) throw await leerError(response, "No se pudo consultar la disponibilidad del turno");
    return response.json() as Promise<PetRescheduleAvailability>;
  },

  async reprogramar(turnoId: number, fecha: string, hora: string): Promise<{
    id: number;
    fecha: string;
    hora: string;
    horaFin: string;
    estado: "activo";
    mascotaId: number;
    clienteId: number | null;
    servicioId: number | null;
  }> {
    const response = await fetchWithAuth(`${API_URL}/api/pet/admin/turnos/${turnoId}/reprogramar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, hora }),
    });
    if (!response.ok) throw await leerError(response, "No se pudo reprogramar el turno PET");
    return response.json();
  },
};
