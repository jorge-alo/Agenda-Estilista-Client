import { isPublicPetAbort, publicPetHttpErrorFromResponse, publicPetNetworkError, publicPetProtocolError } from "./publicPetHttp.ts";
import type {
  PetAvailability,
  PetAvailabilityInput,
  PetBookingContext,
  PetBookingOptions,
  PetCreateBookingInput,
  PetCreatedBooking,
} from "../types/publicPetBooking.types.ts";

const API_URL = import.meta.env?.VITE_API_URL ?? "";
const INT_MAX = 2147483647;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

interface ReadOptions {
  signal?: AbortSignal;
}

function bookingPath(context: PetBookingContext, endpoint: "disponibilidad" | "turnos"): string {
  return `${API_URL}/api/pet/public/${encodeURIComponent(context.slug)}/${endpoint}`;
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= INT_MAX;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10 || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validSlot(value: unknown): value is { horaInicio: string; horaFin: string } {
  if (!isRecord(value) || typeof value.horaInicio !== "string" || typeof value.horaFin !== "string"
    || !HORA.test(value.horaInicio) || !HORA.test(value.horaFin)) return false;
  return value.horaInicio < value.horaFin;
}

function parseOptions(value: unknown): PetBookingOptions | null {
  if (!isRecord(value) || !Array.isArray(value.servicios) || !Array.isArray(value.extras)) return null;
  const servicios: PetBookingOptions["servicios"] = [];
  for (const item of value.servicios) {
    if (!isRecord(item) || !validId(item.id) || typeof item.nombre !== "string" || !validDuration(item.duracionMinutos)) return null;
    servicios.push({ id: item.id, nombre: item.nombre, duracionMinutos: item.duracionMinutos });
  }
  const extras: PetBookingOptions["extras"] = [];
  for (const item of value.extras) {
    if (!isRecord(item) || !validId(item.id) || typeof item.nombre !== "string" || !validDuration(item.duracionExtraMinutos)) return null;
    extras.push({ id: item.id, nombre: item.nombre, duracionExtraMinutos: item.duracionExtraMinutos });
  }
  return { servicios, extras };
}

function parseAvailability(value: unknown): PetAvailability | null {
  if (!isRecord(value) || !validDate(value.fecha) || !validDuration(value.duracionMinutos) || !Array.isArray(value.slots)) return null;
  const slots: PetAvailability["slots"] = [];
  for (const item of value.slots) {
    if (!validSlot(item)) return null;
    slots.push({ horaInicio: item.horaInicio, horaFin: item.horaFin });
  }
  return { fecha: value.fecha, duracionMinutos: value.duracionMinutos, slots };
}

function parseCreatedBooking(value: unknown): PetCreatedBooking | null {
  if (!isRecord(value) || !validId(value.id) || !validDate(value.fecha)
    || typeof value.hora !== "string" || !HORA.test(value.hora)
    || typeof value.horaFin !== "string" || !HORA.test(value.horaFin)
    || value.hora >= value.horaFin || value.estado !== "activo") return null;
  return { id: value.id, fecha: value.fecha, hora: value.hora, horaFin: value.horaFin, estado: "activo" };
}

async function requestJson<T>(
  url: string,
  token: string,
  method: "GET" | "POST",
  signal: AbortSignal | undefined,
  expectedStatus: number,
  parse: (payload: unknown) => T | null,
  payload?: object,
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (payload) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
  } catch (error: unknown) {
    if (isPublicPetAbort(error, signal)) throw error;
    throw publicPetNetworkError();
  }

  if (!response.ok) throw await publicPetHttpErrorFromResponse(response);
  if (response.status !== expectedStatus) throw publicPetProtocolError(response.status);

  let body: unknown;
  try { body = await response.json(); }
  catch (error: unknown) {
    if (isPublicPetAbort(error, signal)) throw error;
    throw publicPetProtocolError(response.status);
  }
  const parsed = parse(body);
  if (parsed === null) throw publicPetProtocolError(response.status);
  return parsed;
}

/** Returns a fresh sorted copy; duplicates are preserved for the backend DTO validator to reject. */
export function ordenarExtraIds(extraIds: readonly number[]): number[] {
  return [...extraIds].sort((a, b) => a - b);
}

function availabilityPayload(input: PetAvailabilityInput): PetAvailabilityInput {
  return {
    mascotaId: input.mascotaId,
    servicioId: input.servicioId,
    extraIds: ordenarExtraIds(input.extraIds),
    fecha: input.fecha,
  };
}

export const publicPetBookingService = {
  getOpcionesReserva(context: PetBookingContext, mascotaId: number, options: ReadOptions = {}): Promise<PetBookingOptions> {
    const url = `${API_URL}/api/pet/public/${encodeURIComponent(context.slug)}/mascotas/${mascotaId}/opciones-reserva`;
    return requestJson(url, context.token, "GET", options.signal, 200, parseOptions);
  },

  getDisponibilidad(context: PetBookingContext, input: PetAvailabilityInput, options: ReadOptions = {}): Promise<PetAvailability> {
    return requestJson(
      bookingPath(context, "disponibilidad"), context.token, "POST", options.signal, 200,
      parseAvailability, availabilityPayload(input),
    );
  },

  crearTurno(context: PetBookingContext, input: PetCreateBookingInput): Promise<PetCreatedBooking> {
    const payload: PetCreateBookingInput = {
      mascotaId: input.mascotaId,
      servicioId: input.servicioId,
      extraIds: ordenarExtraIds(input.extraIds),
      fecha: input.fecha,
      hora: input.hora,
    };
    return requestJson(bookingPath(context, "turnos"), context.token, "POST", undefined, 201, parseCreatedBooking, payload);
  },
};
