import type {
  PetAvailability,
  PetAvailabilitySlot,
  PetBookingExtra,
  PetBookingService,
} from "../types/publicPetBooking.types.ts";

export const PET_BOOKING_PRICE_NOTE = "El valor final se confirma en el local.";
export const PET_BOOKING_OPTIONS_LOADING = "Cargando servicios disponibles…";
export const PET_BOOKING_OPTIONS_ERROR = "No pudimos cargar la información. Intentá nuevamente.";
export const PET_BOOKING_EMPTY_MASCOTAS = "No tenés mascotas habilitadas para reservar online.";
export const PET_BOOKING_EMPTY_SERVICES = "No hay servicios habilitados para esta mascota.";
export const PET_BOOKING_SLOTS_LOADING = "Buscando horarios disponibles…";
export const PET_BOOKING_EMPTY_SLOTS = "No hay horarios disponibles para esta fecha.";
export const PET_BOOKING_SUBMITTING = "Confirmando turno…";

export type PetBookingOptionsView = "idle" | "loading" | "error" | "ready";
export type PetBookingSlotsView = "loading" | "error" | "empty" | "ready";

export function petBookingExtraLabel(extra: Pick<PetBookingExtra, "nombre" | "duracionExtraMinutos">): string {
  return `${extra.nombre} (+${extra.duracionExtraMinutos} min)`;
}

export function petBookingSlotLabel(slot: Pick<PetAvailabilitySlot, "horaInicio" | "horaFin">): string {
  return `${slot.horaInicio} – ${slot.horaFin}`;
}

export function petBookingDurationLabel(minutes: number | null): string | null {
  return minutes === null ? null : `${minutes} min`;
}

/** Visual-only estimate for the current draft; never an authority over the server. */
export function petBookingEstimatedDurationMinutes(
  servicio: Pick<PetBookingService, "duracionMinutos"> | null,
  extras: readonly Pick<PetBookingExtra, "duracionExtraMinutos">[],
): number | null {
  if (!servicio) return null;
  let total = servicio.duracionMinutos;
  for (const extra of extras) total += extra.duracionExtraMinutos;
  return total;
}

/** Availability for the current selection wins; the estimate only fills the gap before it loads. */
export function petBookingDisplayedDurationMinutes(
  availability: Pick<PetAvailability, "duracionMinutos"> | undefined,
  servicio: Pick<PetBookingService, "duracionMinutos"> | null,
  extras: readonly Pick<PetBookingExtra, "duracionExtraMinutos">[],
): number | null {
  return availability?.duracionMinutos ?? petBookingEstimatedDurationMinutes(servicio, extras);
}

/** Loading always wins so stale slots are never shown while the selection refetches. */
export function petBookingSlotsView(input: {
  isFetching: boolean;
  isError: boolean;
  slots: readonly PetAvailabilitySlot[] | null;
}): PetBookingSlotsView {
  if (input.isFetching) return "loading";
  if (input.isError) return "error";
  if (input.slots === null) return "loading";
  return input.slots.length === 0 ? "empty" : "ready";
}
