import {
  PET_MANAGEMENT_SEARCH_MAX_LENGTH,
  PET_MANAGEMENT_SEARCH_MIN_LENGTH,
  type PetManagementEstado,
} from "../types/petManagement.types.ts";

export type PetManagementSearchInputState = "empty" | "too-short" | "too-long" | "ready";

export interface PetManagementState {
  rawTerm: string;
  estado: PetManagementEstado;
  selectedMascotaId: number | null;
  detailNotFound: boolean;
}

export function petManagementNormalizedTerm(value: string): string {
  return value.trim();
}

export function petManagementSearchRequestTerm(value: string): string | null {
  const term = petManagementNormalizedTerm(value);
  return term.length < PET_MANAGEMENT_SEARCH_MIN_LENGTH || term.length > PET_MANAGEMENT_SEARCH_MAX_LENGTH
    ? null
    : term;
}

export function petManagementSearchInputState(value: string): PetManagementSearchInputState {
  const length = petManagementNormalizedTerm(value).length;
  if (length === 0) return "empty";
  if (length < PET_MANAGEMENT_SEARCH_MIN_LENGTH) return "too-short";
  if (length > PET_MANAGEMENT_SEARCH_MAX_LENGTH) return "too-long";
  return "ready";
}

export function petManagementValidId(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

export function petManagementInitialState(): PetManagementState {
  return {
    rawTerm: "",
    estado: "todas",
    selectedMascotaId: null,
    detailNotFound: false,
  };
}

export type PetManagementAction =
  | { type: "SET_RAW_TERM"; rawTerm: string }
  | { type: "SET_ESTADO"; estado: PetManagementEstado }
  | { type: "SELECT_MASCOTA"; mascotaId: number }
  | { type: "DETAIL_NOT_FOUND"; mascotaId: number };

export function petManagementReducer(
  state: PetManagementState,
  action: PetManagementAction,
): PetManagementState {
  switch (action.type) {
    case "SET_RAW_TERM":
      return action.rawTerm === state.rawTerm ? state : { ...state, rawTerm: action.rawTerm };
    case "SET_ESTADO":
      return action.estado === state.estado ? state : { ...state, estado: action.estado };
    case "SELECT_MASCOTA":
      if (!petManagementValidId(action.mascotaId) || action.mascotaId === state.selectedMascotaId) return state;
      return { ...state, selectedMascotaId: action.mascotaId, detailNotFound: false };
    case "DETAIL_NOT_FOUND":
      if (state.selectedMascotaId !== action.mascotaId) return state;
      return { ...state, selectedMascotaId: null, detailNotFound: true };
  }
}
