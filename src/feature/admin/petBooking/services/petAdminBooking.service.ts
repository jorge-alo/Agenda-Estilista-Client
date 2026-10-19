import { fetchWithAuth } from "../../../../shared/lib/fetchWithAuth.ts";
import type {
  PetAdminAvailability,
  PetAdminAvailabilityInput,
  PetAdminCreateBookingInput,
  PetAdminCreatedBooking,
  PetAdminExtra,
  PetAdminMascota,
  PetAdminMascotaDetail,
  PetAdminResponsable,
  PetAdminServicio,
} from "../types/petAdminBooking.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const INT_MAX = 2147483647;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PetAdminBookingApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null) {
    super("PET_ADMIN_BOOKING_API_ERROR");
    this.name = "PetAdminBookingApiError";
    this.status = status;
    this.code = code;
  }
}

interface ReadOptions {
  signal?: AbortSignal;
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function idValido(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= INT_MAX;
}

function minutosValidos(value: unknown): value is number {
  return idValido(value);
}

function banderaDb(value: unknown): boolean | null {
  if (value === 0) return false;
  if (value === 1) return true;
  return null;
}

function fechaValida(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function parseMascota(value: unknown): PetAdminMascota | null {
  if (!esRegistro(value) || !idValido(value.id) || typeof value.nombre !== "string") return null;
  const activo = banderaDb(value.activo);
  const reservaOnlineHabilitada = banderaDb(value.reserva_online_habilitada);
  if (activo === null || reservaOnlineHabilitada === null) return null;
  return { id: value.id, nombre: value.nombre, activo, reservaOnlineHabilitada };
}

function parseMascotas(value: unknown): PetAdminMascota[] | null {
  if (!Array.isArray(value)) return null;
  const mascotas: PetAdminMascota[] = [];
  for (const item of value) {
    const mascota = parseMascota(item);
    if (!mascota) return null;
    mascotas.push(mascota);
  }
  return mascotas;
}

function parseResponsable(value: unknown): PetAdminResponsable | null {
  if (!esRegistro(value) || !idValido(value.id)
    || typeof value.nombre !== "string" || typeof value.telefono !== "string") return null;
  return { clienteId: value.id, nombre: value.nombre, telefono: value.telefono };
}

function parseMascotaDetail(value: unknown): PetAdminMascotaDetail | null {
  const mascota = parseMascota(value);
  if (!mascota || !esRegistro(value) || !Array.isArray(value.responsables)) return null;
  const responsables: PetAdminResponsable[] = [];
  for (const item of value.responsables) {
    const responsable = parseResponsable(item);
    if (!responsable) return null;
    responsables.push(responsable);
  }
  return { ...mascota, responsables };
}

function parseConfigurados(value: unknown): PetAdminServicio[] | PetAdminExtra[] | null {
  if (!Array.isArray(value)) return null;
  const configurados: Array<PetAdminServicio | PetAdminExtra> = [];
  for (const item of value) {
    if (!esRegistro(item) || !idValido(item.id) || typeof item.nombre !== "string") return null;
    // The shared service catalogue may retain SQL NULL in its nullable activo column; it is unusable for booking.
    const activo = item.activo === null ? false : banderaDb(item.activo);
    if (activo === null || !minutosValidos(item.duracion_minutos)) return null;
    configurados.push({ id: item.id, nombre: item.nombre, activo, duracionMinutos: item.duracion_minutos });
  }
  return configurados;
}

function parseDisponibilidad(value: unknown): PetAdminAvailability | null {
  if (!esRegistro(value) || !fechaValida(value.fecha) || !minutosValidos(value.duracionMinutos)
    || !Array.isArray(value.slots)) return null;
  const slots: PetAdminAvailability["slots"] = [];
  for (const item of value.slots) {
    if (!esRegistro(item) || typeof item.horaInicio !== "string" || !HORA.test(item.horaInicio)
      || typeof item.horaFin !== "string" || !HORA.test(item.horaFin) || item.horaInicio >= item.horaFin) return null;
    slots.push({ horaInicio: item.horaInicio, horaFin: item.horaFin });
  }
  return { fecha: value.fecha, duracionMinutos: value.duracionMinutos, slots };
}

function parseCreado(value: unknown): PetAdminCreatedBooking | null {
  if (!esRegistro(value) || !idValido(value.id) || !fechaValida(value.fecha)
    || typeof value.hora !== "string" || !HORA.test(value.hora)
    || typeof value.horaFin !== "string" || !HORA.test(value.horaFin)
    || value.hora >= value.horaFin || value.estado !== "activo"
    || !idValido(value.mascotaId) || !idValido(value.clienteId) || !idValido(value.servicioId)) return null;
  return {
    id: value.id,
    fecha: value.fecha,
    hora: value.hora,
    horaFin: value.horaFin,
    estado: "activo",
    mascotaId: value.mascotaId,
    clienteId: value.clienteId,
    servicioId: value.servicioId,
  };
}

function parsearCodigo(value: unknown): string | null {
  if (!esRegistro(value) || typeof value.code !== "string" || value.code.length === 0) return null;
  return value.code;
}

async function errorHttp(response: Response): Promise<PetAdminBookingApiError> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  return new PetAdminBookingApiError(response.status, parsearCodigo(body));
}

async function respuestaJson<T>(
  path: string,
  parse: (value: unknown) => T | null,
  options: ReadOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
      method: "GET",
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error: unknown) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    if (error instanceof Error && error.message === "Sesión expirada") {
      throw new PetAdminBookingApiError(401, null);
    }
    throw new PetAdminBookingApiError(0, null);
  }
  if (!response.ok) throw await errorHttp(response);
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new PetAdminBookingApiError(response.status, null); }
  const parsed = parse(body);
  if (parsed === null) throw new PetAdminBookingApiError(response.status, null);
  return parsed;
}

async function mutationJson<T>(path: string, payload: object, parse: (value: unknown) => T | null): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}/api/pet/admin${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Sesión expirada") {
      throw new PetAdminBookingApiError(401, null);
    }
    throw new PetAdminBookingApiError(0, null);
  }
  if (!response.ok) throw await errorHttp(response);
  if (response.status !== 201) throw new PetAdminBookingApiError(response.status, null);
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new PetAdminBookingApiError(response.status, null); }
  const parsed = parse(body);
  if (parsed === null) throw new PetAdminBookingApiError(response.status, null);
  return parsed;
}

export function ordenarPetAdminExtraIds(extraIds: readonly number[]): number[] {
  return [...extraIds].sort((left, right) => left - right);
}

export const petAdminBookingService = {
  listarMascotas(options: ReadOptions = {}): Promise<PetAdminMascota[]> {
    return respuestaJson("/mascotas", parseMascotas, options);
  },

  obtenerMascota(mascotaId: number, options: ReadOptions = {}): Promise<PetAdminMascotaDetail> {
    return respuestaJson(`/mascotas/${encodeURIComponent(String(mascotaId))}`, parseMascotaDetail, options);
  },

  listarServicios(mascotaId: number, options: ReadOptions = {}): Promise<PetAdminServicio[]> {
    return respuestaJson(`/mascotas/${encodeURIComponent(String(mascotaId))}/servicios`, value =>
      parseConfigurados(value) as PetAdminServicio[] | null, options);
  },

  listarExtras(mascotaId: number, options: ReadOptions = {}): Promise<PetAdminExtra[]> {
    return respuestaJson(`/mascotas/${encodeURIComponent(String(mascotaId))}/extras`, value =>
      parseConfigurados(value) as PetAdminExtra[] | null, options);
  },

  obtenerDisponibilidad(input: PetAdminAvailabilityInput, options: ReadOptions = {}): Promise<PetAdminAvailability> {
    const query = new URLSearchParams({
      mascotaId: String(input.mascotaId),
      servicioId: String(input.servicioId),
      fecha: input.fecha,
    });
    for (const extraId of ordenarPetAdminExtraIds(input.extraIds)) query.append("extraIds", String(extraId));
    return respuestaJson(`/disponibilidad?${query.toString()}`, parseDisponibilidad, options);
  },

  crearTurno(input: PetAdminCreateBookingInput): Promise<PetAdminCreatedBooking> {
    const payload = {
      mascotaId: input.mascotaId,
      clienteId: input.clienteId,
      servicioId: input.servicioId,
      extraIds: ordenarPetAdminExtraIds(input.extraIds),
      fecha: input.fecha,
      hora: input.hora,
    };
    return mutationJson("/turnos", payload, parseCreado);
  },
};
