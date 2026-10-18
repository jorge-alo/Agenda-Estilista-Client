import type {
  PetAvailability,
  PetBookingExtra,
  PetBookingOptions,
  PetCreatedBooking,
} from "../types/publicPetBooking.types.ts";

const INT_MAX = 2147483647;
const MAX_EXTRAS = 100;
const BOOKING_UNAVAILABLE_MESSAGE = "Las reservas online no están disponibles en este momento.";
const SLOT_CONFLICT_MESSAGE = "Ese horario acaba de dejar de estar disponible.";

export interface PetBookingPet {
  id: number;
  nombre: string;
}

export interface PetBookingDraft {
  mascotaId: number | null;
  servicioId: number | null;
  extraIds: readonly number[];
  fecha: string;
  slotSeleccionado: PetBookingSelectedSlot | null;
}

export interface PetBookingSelectedSlot {
  horaInicio: string;
  horaFin: string;
  /** Deterministic selection key; reducer instances are scoped to one landing/slug. */
  selectionKey: string;
}

export interface PetBookingState {
  draft: PetBookingDraft;
  avisoRecuperable: string | null;
  bookingUnavailable: boolean;
  success: PetBookingSuccess | null;
}

export interface PetBookingSuccessBase {
  mascotaNombre: string;
  servicioNombre: string;
  extras: readonly Pick<PetBookingExtra, "id" | "nombre">[];
  fecha: string;
  duracionMinutos: number;
}

export interface PetBookingSuccess extends PetBookingSuccessBase {
  hora: string;
  horaFin: string;
  estado: "activo";
}

export type PetBookingExtraToggleResult =
  | { accepted: true; extraIds: number[] }
  | { accepted: false; reason: "INVALID_ID" | "MAX_EXTRAS" };

export type PetBookingAction =
  | { type: "SET_MASCOTA"; mascotaId: number | null }
  | { type: "SET_SERVICIO"; servicioId: number | null }
  | { type: "TOGGLE_EXTRA"; extraId: number }
  | { type: "SET_FECHA"; fecha: string }
  | { type: "SET_SLOT"; slot: { horaInicio: string; horaFin: string; selectionKey: string } }
  | { type: "SLOT_CONFLICT" }
  | { type: "BOOKING_UNAVAILABLE" }
  | { type: "RETRY_BOOKING" }
  | { type: "RECONCILE_PROFILE"; mascotas: readonly PetBookingPet[] }
  | { type: "RECONCILE_OPTIONS"; opciones: PetBookingOptions }
  | { type: "SET_SUCCESS"; success: PetBookingSuccess }
  | { type: "START_NEW_BOOKING"; mascotas: readonly PetBookingPet[] }
  | { type: "CLEAR_NOTICE" };

function emptyDraft(mascotaId: number | null = null): PetBookingDraft {
  return { mascotaId, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null };
}

function emptyState(mascotaId: number | null = null): PetBookingState {
  return { draft: emptyDraft(mascotaId), avisoRecuperable: null, bookingUnavailable: false, success: null };
}

function validId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= INT_MAX;
}

export function uniqueSortedExtraIds(extraIds: readonly number[]): number[] {
  return [...new Set(extraIds)].sort((a, b) => a - b);
}

export function togglePetBookingExtra(extraIds: readonly number[], extraId: number): PetBookingExtraToggleResult {
  if (!validId(extraId)) return { accepted: false, reason: "INVALID_ID" };
  const sorted = uniqueSortedExtraIds(extraIds);
  if (sorted.includes(extraId)) return { accepted: true, extraIds: sorted.filter(id => id !== extraId) };
  if (sorted.length >= MAX_EXTRAS) return { accepted: false, reason: "MAX_EXTRAS" };
  return { accepted: true, extraIds: uniqueSortedExtraIds([...sorted, extraId]) };
}

export function isPetBookingDate(value: string): boolean {
  if (value === "") return true;
  if (value.length !== 10 || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Parse date components directly; never let YYYY-MM-DD be interpreted as UTC or host local time. */
export function formatearFechaBookingArgentina(value: string): string {
  if (!isPetBookingDate(value) || value === "") return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Creates a fresh draft; only a single initially available pet is auto-selected. */
export function crearEstadoInicialBooking(mascotas: readonly PetBookingPet[]): PetBookingState {
  return emptyState(mascotas.length === 1 ? mascotas[0].id : null);
}

export function petBookingSelectionKey(draft: PetBookingDraft): string | null {
  if (draft.mascotaId === null || draft.servicioId === null || !isPetBookingDate(draft.fecha) || draft.fecha === "") return null;
  return JSON.stringify([
    "pet-booking-selection-v1",
    draft.mascotaId,
    draft.servicioId,
    uniqueSortedExtraIds(draft.extraIds),
    draft.fecha,
  ]);
}

function updateDraft(state: PetBookingState, draft: PetBookingDraft): PetBookingState {
  return { ...state, draft, avisoRecuperable: null, success: null };
}

function resetSelection(state: PetBookingState): PetBookingState {
  return updateDraft(state, emptyDraft());
}

export function petBookingReducer(state: PetBookingState, action: PetBookingAction): PetBookingState {
  switch (action.type) {
    case "SET_MASCOTA": {
      if (action.mascotaId === state.draft.mascotaId) return state;
      return updateDraft(state, emptyDraft(action.mascotaId));
    }
    case "SET_SERVICIO": {
      if (action.servicioId === state.draft.servicioId) return state;
      return updateDraft(state, { ...state.draft, servicioId: action.servicioId, slotSeleccionado: null });
    }
    case "TOGGLE_EXTRA": {
      const toggled = togglePetBookingExtra(state.draft.extraIds, action.extraId);
      if (!toggled.accepted || (toggled.extraIds.length === state.draft.extraIds.length
        && toggled.extraIds.every((id, index) => id === state.draft.extraIds[index]))) return state;
      return updateDraft(state, { ...state.draft, extraIds: toggled.extraIds, slotSeleccionado: null });
    }
    case "SET_FECHA": {
      if (!isPetBookingDate(action.fecha) || action.fecha === state.draft.fecha) return state;
      return updateDraft(state, { ...state.draft, fecha: action.fecha, slotSeleccionado: null });
    }
    case "SET_SLOT": {
      const key = petBookingSelectionKey(state.draft);
      if (state.bookingUnavailable || !key || action.slot.selectionKey !== key
        || !validSlot(action.slot.horaInicio, action.slot.horaFin)) return state;
      return {
        ...state,
        avisoRecuperable: null,
        success: null,
        draft: { ...state.draft, slotSeleccionado: { ...action.slot } },
      };
    }
    case "SLOT_CONFLICT":
      return {
        ...state,
        draft: { ...state.draft, slotSeleccionado: null },
        avisoRecuperable: SLOT_CONFLICT_MESSAGE,
        success: null,
      };
    case "BOOKING_UNAVAILABLE":
      return {
        ...state,
        draft: { ...state.draft, slotSeleccionado: null },
        avisoRecuperable: BOOKING_UNAVAILABLE_MESSAGE,
        bookingUnavailable: true,
        success: null,
      };
    case "RETRY_BOOKING":
      if (!state.bookingUnavailable && state.avisoRecuperable === null) return state;
      return { ...state, bookingUnavailable: false, avisoRecuperable: null, draft: { ...state.draft, slotSeleccionado: null } };
    case "RECONCILE_PROFILE": {
      const selectedPetExists = state.draft.mascotaId !== null
        && action.mascotas.some(mascota => mascota.id === state.draft.mascotaId);
      return state.draft.mascotaId !== null && !selectedPetExists ? resetSelection(state) : state;
    }
    case "RECONCILE_OPTIONS": {
      const validServices = new Set(action.opciones.servicios.map(service => service.id));
      const validExtras = new Set(action.opciones.extras.map(extra => extra.id));
      const servicioId = state.draft.servicioId !== null && validServices.has(state.draft.servicioId)
        ? state.draft.servicioId : null;
      const extraIds = uniqueSortedExtraIds(state.draft.extraIds.filter(id => validExtras.has(id)));
      const changed = servicioId !== state.draft.servicioId
        || extraIds.length !== state.draft.extraIds.length
        || extraIds.some((id, index) => id !== state.draft.extraIds[index]);
      if (!changed) return state;
      return updateDraft(state, { ...state.draft, servicioId, extraIds, slotSeleccionado: null });
    }
    case "SET_SUCCESS":
      if (state.bookingUnavailable) return state;
      return { ...state, draft: { ...state.draft, slotSeleccionado: null }, success: cloneSuccess(action.success), avisoRecuperable: null };
    case "START_NEW_BOOKING":
      return emptyState(action.mascotas.length === 1 ? action.mascotas[0].id : null);
    case "CLEAR_NOTICE":
      return state.avisoRecuperable === null ? state : { ...state, avisoRecuperable: null };
  }
}

function validSlot(horaInicio: string, horaFin: string): boolean {
  const format = /^([01]\d|2[0-3]):[0-5]\d$/;
  return format.test(horaInicio) && format.test(horaFin) && horaInicio < horaFin;
}

export function crearPetBookingSuccessBase(
  draft: PetBookingDraft,
  mascotas: readonly PetBookingPet[],
  opciones: PetBookingOptions,
  disponibilidad: PetAvailability,
): PetBookingSuccessBase | null {
  const key = petBookingSelectionKey(draft);
  const slot = draft.slotSeleccionado;
  if (!key || !slot || slot.selectionKey !== key || disponibilidad.fecha !== draft.fecha
    || !Number.isSafeInteger(disponibilidad.duracionMinutos) || disponibilidad.duracionMinutos <= 0
    || !disponibilidad.slots.some(item => item.horaInicio === slot.horaInicio && item.horaFin === slot.horaFin)) return null;
  const mascota = mascotas.find(item => item.id === draft.mascotaId);
  const servicio = opciones.servicios.find(item => item.id === draft.servicioId);
  if (!mascota || !servicio) return null;
  const extras: Array<Pick<PetBookingExtra, "id" | "nombre">> = [];
  for (const id of draft.extraIds) {
    const extra = opciones.extras.find(item => item.id === id);
    if (!extra) return null;
    extras.push({ id: extra.id, nombre: extra.nombre });
  }
  return {
    mascotaNombre: mascota.nombre,
    servicioNombre: servicio.nombre,
    extras: extras.map(extra => ({ ...extra })),
    fecha: draft.fecha,
    duracionMinutos: disponibilidad.duracionMinutos,
  };
}

export function combinarPetBookingSuccess(snapshot: PetBookingSuccessBase, created: PetCreatedBooking): PetBookingSuccess {
  return {
    mascotaNombre: snapshot.mascotaNombre,
    servicioNombre: snapshot.servicioNombre,
    extras: snapshot.extras.map(extra => ({ id: extra.id, nombre: extra.nombre })),
    fecha: created.fecha,
    duracionMinutos: snapshot.duracionMinutos,
    hora: created.hora,
    horaFin: created.horaFin,
    estado: created.estado,
  };
}

function cloneSuccess(success: PetBookingSuccess): PetBookingSuccess {
  return { ...success, extras: success.extras.map(extra => ({ id: extra.id, nombre: extra.nombre })) };
}
