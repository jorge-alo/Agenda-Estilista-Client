import type {
  PetAdminAvailability, PetAdminCreatedBooking, PetAdminExtra, PetAdminMascota,
  PetAdminMascotaDetail, PetAdminServicio,
} from "../types/petAdminBooking.types.ts";

export interface PetAdminSelectedSlot {
  horaInicio: string;
  horaFin: string;
  selectionKey: string;
}

export interface PetAdminBookingDraft {
  mascotaId: number | null;
  clienteId: number | null;
  servicioId: number | null;
  extraIds: number[];
  fecha: string;
  slotSeleccionado: PetAdminSelectedSlot | null;
}

export interface PetAdminBookingSuccessBase {
  readonly mascotaNombre: string;
  readonly responsableNombre: string;
  readonly responsableTelefono: string;
  readonly servicioNombre: string;
  readonly extras: readonly Readonly<Pick<PetAdminExtra, "id" | "nombre" | "duracionMinutos">>[];
  readonly fecha: string;
  readonly duracionMinutos: number;
}

export interface PetAdminBookingSuccess extends PetAdminBookingSuccessBase {
  readonly id: number;
  readonly hora: string;
  readonly horaFin: string;
  readonly estado: "activo";
}

export interface PetAdminBookingState {
  draft: PetAdminBookingDraft;
  success: PetAdminBookingSuccess | null;
}

export function petAdminValidId(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

export function petAdminValidDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function petAdminInitialState(): PetAdminBookingState {
  return { draft: { mascotaId: null, clienteId: null, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null }, success: null };
}

export function petAdminSelectionKey(draft: Pick<PetAdminBookingDraft, "mascotaId" | "servicioId" | "extraIds" | "fecha">): string {
  return JSON.stringify(["pet-admin-selection-v1", draft.mascotaId, draft.servicioId, [...draft.extraIds].sort((a, b) => a - b), draft.fecha]);
}

export const petAdminSelectableMascotas = (items: readonly PetAdminMascota[]) => items.filter(item => item.activo);
export const petAdminUsableOptions = <T extends PetAdminServicio | PetAdminExtra>(items: readonly T[]) =>
  items.filter(item => item.activo && Number.isSafeInteger(item.duracionMinutos) && item.duracionMinutos > 0);

export type PetAdminBookingAction =
  | { type: "SET_MASCOTA"; mascotaId: number | null }
  | { type: "SET_CLIENTE"; clienteId: number | null }
  | { type: "SET_SERVICIO"; servicioId: number | null }
  | { type: "TOGGLE_EXTRA"; extraId: number }
  | { type: "SET_FECHA"; fecha: string }
  | { type: "SET_SLOT"; slot: PetAdminSelectedSlot }
  | { type: "CLEAR_SLOT" }
  | { type: "MASCOTA_UNAVAILABLE"; mascotaId: number }
  | { type: "RECONCILE_DETAIL"; detail: PetAdminMascotaDetail; initial: boolean }
  | { type: "RECONCILE_SERVICIOS"; servicios: readonly PetAdminServicio[] }
  | { type: "RECONCILE_EXTRAS"; extras: readonly PetAdminExtra[] }
  | { type: "SUCCESS"; success: PetAdminBookingSuccess }
  | { type: "START_NEW_BOOKING" };

/** Remote responses are inputs to reconciliation, never part of the stored state. */
export function petAdminBookingReducer(state: PetAdminBookingState, action: PetAdminBookingAction): PetAdminBookingState {
  const draft = state.draft;
  const change = (patch: Partial<PetAdminBookingDraft>) => ({ ...state, draft: { ...draft, ...patch } });
  switch (action.type) {
    case "START_NEW_BOOKING": return petAdminInitialState();
    case "SUCCESS": return { ...state, success: action.success };
    case "SET_MASCOTA": {
      if (action.mascotaId === draft.mascotaId || (action.mascotaId !== null && !petAdminValidId(action.mascotaId))) return state;
      const initial = petAdminInitialState();
      return { ...initial, draft: { ...initial.draft, mascotaId: action.mascotaId } };
    }
    case "SET_CLIENTE":
      if (action.clienteId === draft.clienteId || (action.clienteId !== null && !petAdminValidId(action.clienteId))) return state;
      // Calendar availability and selectionKey do not depend on the responsible person.
      return change({ clienteId: action.clienteId });
    case "SET_SERVICIO":
      if (action.servicioId === draft.servicioId || (action.servicioId !== null && !petAdminValidId(action.servicioId))) return state;
      return change({ servicioId: action.servicioId, slotSeleccionado: null });
    case "TOGGLE_EXTRA": {
      if (!petAdminValidId(action.extraId)) return state;
      // Admin has no numeric cap in its contract; the controller limits choices to the active catalogue.
      const ids = new Set(draft.extraIds);
      if (ids.has(action.extraId)) ids.delete(action.extraId); else ids.add(action.extraId);
      return change({ extraIds: [...ids].sort((a, b) => a - b), slotSeleccionado: null });
    }
    case "SET_FECHA":
      if (draft.fecha === action.fecha || (action.fecha !== "" && !petAdminValidDate(action.fecha))) return state;
      return change({ fecha: action.fecha, slotSeleccionado: null });
    case "SET_SLOT": {
      const slot = action.slot;
      const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!petAdminValidId(draft.mascotaId) || !petAdminValidId(draft.servicioId) || !petAdminValidDate(draft.fecha)
        || slot.selectionKey !== petAdminSelectionKey(draft) || !hora.test(slot.horaInicio)
        || !hora.test(slot.horaFin) || slot.horaInicio >= slot.horaFin) return state;
      return change({ slotSeleccionado: { ...slot } });
    }
    case "CLEAR_SLOT": return draft.slotSeleccionado ? change({ slotSeleccionado: null }) : state;
    case "MASCOTA_UNAVAILABLE":
      return draft.mascotaId === action.mascotaId ? petAdminInitialState() : state;
    case "RECONCILE_DETAIL": {
      if (action.detail.id !== draft.mascotaId) return state;
      if (!action.detail.activo) return petAdminInitialState();
      const items = action.detail.responsables;
      if (draft.clienteId !== null) {
        return items.some(item => item.clienteId === draft.clienteId) ? state : change({ clienteId: null });
      }
      // Only the first detail for a user-selected pet may preselect. Never replace during refresh.
      return action.initial && items.length === 1 ? change({ clienteId: items[0].clienteId }) : state;
    }
    case "RECONCILE_SERVICIOS":
      return draft.servicioId !== null && !petAdminUsableOptions(action.servicios).some(item => item.id === draft.servicioId)
        ? change({ servicioId: null, slotSeleccionado: null }) : state;
    case "RECONCILE_EXTRAS": {
      const usable = new Set(petAdminUsableOptions(action.extras).map(item => item.id));
      const ids = draft.extraIds.filter(id => usable.has(id));
      return ids.length === draft.extraIds.length ? state : change({ extraIds: ids, slotSeleccionado: null });
    }
  }
}

export function petAdminSuccessSnapshot(
  draft: PetAdminBookingDraft,
  detail: PetAdminMascotaDetail,
  servicios: readonly PetAdminServicio[],
  extras: readonly PetAdminExtra[],
  availability: PetAdminAvailability,
): PetAdminBookingSuccessBase | null {
  const responsable = detail.responsables.find(item => item.clienteId === draft.clienteId);
  const servicio = petAdminUsableOptions(servicios).find(item => item.id === draft.servicioId);
  const slot = draft.slotSeleccionado;
  const selectedExtras = draft.extraIds.map(id => petAdminUsableOptions(extras).find(item => item.id === id));
  if (!detail.activo || detail.id !== draft.mascotaId || !responsable || !servicio
    || selectedExtras.some(item => !item) || new Set(draft.extraIds).size !== draft.extraIds.length
    || !petAdminValidDate(draft.fecha) || draft.fecha !== availability.fecha || !slot
    || slot.selectionKey !== petAdminSelectionKey(draft)
    || !availability.slots.some(item => item.horaInicio === slot.horaInicio && item.horaFin === slot.horaFin)) return null;
  return Object.freeze({
    mascotaNombre: detail.nombre, responsableNombre: responsable.nombre, responsableTelefono: responsable.telefono,
    servicioNombre: servicio.nombre, fecha: draft.fecha, duracionMinutos: availability.duracionMinutos,
    extras: Object.freeze(selectedExtras.flatMap(item => item ? [Object.freeze({ id: item.id, nombre: item.nombre, duracionMinutos: item.duracionMinutos })] : [])),
  });
}

export function petAdminCombineSuccess(base: PetAdminBookingSuccessBase, created: PetAdminCreatedBooking): PetAdminBookingSuccess {
  return Object.freeze({ ...base, id: created.id, hora: created.hora, horaFin: created.horaFin, estado: created.estado });
}
