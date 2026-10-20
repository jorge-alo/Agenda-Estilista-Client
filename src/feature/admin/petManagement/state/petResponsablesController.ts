import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { emptyResponsableDraft, normalizeResponsableDraft, validateResponsableDraft, type ResponsableDraft, type ResponsableErrors } from "../forms/petResponsableForm.ts";
import { associateResponsableMutation, createResponsableMutation, removeResponsableMutation } from "../mutations/petResponsablesMutations.ts";
import { petManagementDetailQuery } from "../queries/petManagementQueries.ts";
import { PetManagementApiError } from "../services/petManagement.service.ts";
import type { ConfirmedResponsable } from "../services/petResponsables.service.ts";
import type { PetManagementDetail, PetManagementResponsable } from "../types/petManagement.types.ts";

type Mode = "viewing" | "adding" | "creating" | "associating" | "removing" | "checking";
interface RelationAction { kind: "associate" | "remove"; clienteId: number }
interface State {
  mode: Mode;
  draft: ResponsableDraft;
  confirmed: ConfirmedResponsable | null;
  verification: RelationAction | null;
  errors: ResponsableErrors;
  errorMessage: string | null;
  notice: string | null;
  focusList: number;
}
const initial = (focusList = 0, notice: string | null = null): State => ({
  mode: "viewing", draft: emptyResponsableDraft(), confirmed: null, verification: null,
  errors: {}, errorMessage: null, notice, focusList,
});
const busy = (mode: Mode) => !["viewing", "adding"].includes(mode);
const statusOf = (error: unknown) => error instanceof PetManagementApiError ? error.status : 0;
export const RESPONSABLE_EXISTING = "Ya existía un responsable con ese teléfono. Se asociará el registro existente; sus datos no fueron modificados.";
export const RESPONSABLE_CREATE_UNKNOWN = "No pudimos confirmar si el responsable se guardó. Conservamos el formulario; reintentá cuando estés listo.";
export const RESPONSABLE_ASSOCIATION_UNKNOWN = "El responsable está confirmado, pero no se pudo confirmar la asociación. Volvé a intentar asociarlo.";

function knownError(error: unknown): string | null {
  const status = statusOf(error);
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos para gestionar responsables.";
  if (error instanceof PetManagementApiError && error.code === "CLIENT_PHONE_INVALID") return "Revisá el teléfono. El servidor no pudo validarlo.";
  if (status === 400) return "No pudimos validar la operación. Revisá los datos e intentá nuevamente.";
  return null;
}

/** Two sequential writes; confirmed identity survives association failures. GET owns the list. */
export function createPetResponsablesController(client: QueryClient, options: {
  localId: string;
  confirmDiscard: () => boolean;
  confirmRemove: (responsable: PetManagementResponsable, mascotaNombre: string) => boolean;
  onUnavailable: (id: number) => void;
}) {
  let state = initial();
  let selectedId: number | null = null;
  let remote: PetManagementDetail | null = null;
  let generation = 0;
  let connected = true;
  const listeners = new Set<() => void>();
  const create = new MutationObserver(client, createResponsableMutation(client, options.localId));
  const associate = new MutationObserver(client, associateResponsableMutation(client, options.localId));
  const remove = new MutationObserver(client, removeResponsableMutation(client, options.localId));
  const dirty = () => state.confirmed !== null || state.verification !== null
    || Object.values(normalizeResponsableDraft(state.draft)).some(Boolean);
  const snapshot = () => ({ ...state, busy: busy(state.mode), dirty: dirty() });
  let current = snapshot();
  const publish = () => { current = snapshot(); for (const listener of listeners) listener(); };
  const isCurrent = (token: number) => connected && generation === token;
  function reset(notice: string | null = null, focus = false) {
    generation++;
    state = initial(state.focusList + (focus ? 1 : 0), notice);
  }

  function syncSelection(id: number | null, detail: PetManagementDetail | null) {
    if (selectedId !== id) {
      selectedId = id;
      reset();
      remote = detail?.id === id ? detail : null;
      publish();
    } else remote = detail?.id === id ? detail : null;
  }

  async function verify(action: RelationAction, token: number): Promise<boolean> {
    const mascotaId = selectedId;
    if (!isCurrent(token) || mascotaId === null) return false;
    state = { ...state, mode: "checking", verification: action };
    publish();
    try {
      // A GET started before the write cannot confirm its result.
      await client.cancelQueries({ queryKey: queryKeys.petManagement.detail(options.localId, mascotaId), exact: true });
      if (!isCurrent(token)) return false;
      const detail = await client.fetchQuery(petManagementDetailQuery(options.localId, mascotaId));
      if (!isCurrent(token)) return false;
      if (!detail) throw new PetManagementApiError(200, null);
      remote = detail;
      const present = detail.responsables.some(item => item.id === action.clienteId);
      if (present === (action.kind === "associate")) {
        reset(action.kind === "remove" ? "Se quitó la relación con esta mascota. El responsable sigue en el sistema."
          : state.confirmed?.isNew === false ? "Se asoció el responsable existente. Sus datos no fueron modificados." : "Responsable asociado a la mascota.", true);
        publish();
        return true;
      }
      state = {
        ...state, mode: action.kind === "associate" ? "adding" : "viewing", verification: null,
        errorMessage: action.kind === "associate" ? RESPONSABLE_ASSOCIATION_UNKNOWN
          : "La ficha todavía muestra al responsable. Podés volver a quitarlo de esta mascota.",
      };
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      if (statusOf(error) === 404) {
        selectedId = null;
        remote = null;
        reset("La mascota ya no está disponible.");
        options.onUnavailable(mascotaId);
      } else {
        state = {
          ...state, mode: action.kind === "associate" ? "adding" : "viewing",
          errorMessage: knownError(error) ?? "No pudimos verificar la ficha. Conservamos el contexto; reintentá la verificación antes de otra operación.",
        };
      }
    }
    publish();
    return false;
  }

  async function associateConfirmed(token: number): Promise<boolean> {
    const mascotaId = selectedId;
    const responsable = state.confirmed;
    if (!isCurrent(token) || mascotaId === null || !responsable) return false;
    state = { ...state, mode: "associating", errorMessage: null };
    publish();
    try {
      await associate.mutate({ mascotaId, clienteId: responsable.id });
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const message = knownError(error);
      if (message) {
        state = { ...state, mode: "adding", errorMessage: message };
        publish();
        return false;
      }
      state = { ...state, errorMessage: RESPONSABLE_ASSOCIATION_UNKNOWN };
      // Includes 409 and 404: only this pet's fresh detail can reconcile the relationship.
    }
    return verify({ kind: "associate", clienteId: responsable.id }, token);
  }

  async function submit(): Promise<boolean> {
    if (!connected || selectedId === null || state.mode !== "adding" || state.verification) return false;
    const token = ++generation;
    if (!state.confirmed) {
      const errors = validateResponsableDraft(state.draft);
      state = { ...state, errors };
      if (Object.keys(errors).length > 0) { publish(); return false; }
      const draft = normalizeResponsableDraft(state.draft);
      state = { ...state, mode: "creating", errorMessage: null, notice: null };
      publish();
      try {
        const responsable = await create.mutate(draft);
        if (!isCurrent(token)) return false;
        state = { ...state, confirmed: responsable, notice: responsable.isNew ? "Responsable guardado. Asociando a la mascota…" : RESPONSABLE_EXISTING };
      } catch (error: unknown) {
        if (!isCurrent(token)) return false;
        state = { ...state, mode: "adding", errorMessage: knownError(error)
          ?? (statusOf(error) === 409 ? "Hay un conflicto con ese teléfono. Revisalo antes de volver a guardar." : RESPONSABLE_CREATE_UNKNOWN) };
        publish();
        return false;
      }
    }
    return associateConfirmed(token);
  }

  async function removeResponsable(clienteId: number): Promise<boolean> {
    const responsable = remote?.responsables.find(item => item.id === clienteId);
    if (!connected || selectedId === null || state.mode !== "viewing" || state.verification || !responsable || !remote) return false;
    if (!options.confirmRemove(responsable, remote.nombre)) return false;
    const mascotaId = selectedId;
    const token = ++generation;
    state = { ...state, mode: "removing", errorMessage: null, notice: null };
    publish();
    try {
      await remove.mutate({ mascotaId, clienteId });
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const message = knownError(error);
      if (message) {
        state = { ...state, mode: "viewing", errorMessage: message };
        publish();
        return false;
      }
      state = { ...state, errorMessage: "No pudimos confirmar si se quitó la relación. Estamos verificando la ficha." };
    }
    return verify({ kind: "remove", clienteId }, token);
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => { connected = true; },
    disconnect: () => { connected = false; generation++; },
    syncSelection,
    beginAdd: () => {
      if (!connected || !remote || selectedId !== remote.id || state.mode !== "viewing" || state.verification) return false;
      reset(); state = { ...state, mode: "adding" }; publish(); return true;
    },
    change: (field: keyof ResponsableDraft, value: string) => {
      if (state.mode !== "adding" || state.confirmed || state.verification) return;
      state = { ...state, draft: { ...state.draft, [field]: value }, errors: { ...state.errors, [field]: undefined } };
      publish();
    },
    cancel: () => {
      if (busy(state.mode) || (dirty() && !options.confirmDiscard())) return false;
      reset(null, true); publish(); return true;
    },
    submit,
    removeResponsable,
    verify: () => {
      if (!connected || !state.verification || busy(state.mode)) return Promise.resolve(false);
      return verify(state.verification, ++generation);
    },
  };
}

export type PetResponsablesController = ReturnType<typeof createPetResponsablesController>;
export type PetResponsablesSnapshot = ReturnType<PetResponsablesController["getSnapshot"]>;
