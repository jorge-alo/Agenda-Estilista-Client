import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import type { PetManagementDetail } from "../types/petManagement.types.ts";
import {
  buildMascotaDataPatch, detailToMascotaDraft, emptyMascotaDraft, mascotaDraftDirty,
  normalizeMascotaDraft, validateMascotaDraft, MASCOTA_DATA_FIELDS,
  type MascotaData, type MascotaDataField, type MascotaFormDraft, type MascotaFormErrors,
} from "../forms/petMascotaForm.ts";
import { createMascotaMutation, updateMascotaDataMutation } from "../mutations/petMascotaMutations.ts";
import { petManagementDetailQuery } from "../queries/petManagementQueries.ts";
import { PetManagementApiError } from "../services/petManagement.service.ts";
import { petManagementErrorKind } from "../components/petManagementView.ts";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";

export type MascotaFormMode = "viewing" | "creating" | "editing" | "submittingCreate" | "submittingEdit";
interface FormState {
  mode: MascotaFormMode;
  mascotaId: number | null;
  draft: MascotaFormDraft;
  original: MascotaData;
  remote: MascotaData | null;
  errors: MascotaFormErrors;
  errorMessage: string | null;
  needsRefresh: boolean;
  checking: boolean;
  notice: string | null;
  focusDetail: number;
}

const initial = (focusDetail = 0, notice: string | null = null): FormState => ({
  mode: "viewing", mascotaId: null, draft: emptyMascotaDraft(),
  original: normalizeMascotaDraft(emptyMascotaDraft()), remote: null,
  errors: {}, errorMessage: null, needsRefresh: false, checking: false, notice, focusDetail,
});
const equalData = (a: MascotaData, b: MascotaData) => MASCOTA_DATA_FIELDS.every(field => a[field] === b[field]);
const pending = (mode: MascotaFormMode) => mode === "submittingCreate" || mode === "submittingEdit";
const statusOf = (error: unknown) => error instanceof PetManagementApiError ? error.status : 0;

export const MASCOTA_CREATE_UNKNOWN = "No se pudo confirmar si la mascota fue creada. Revisá la búsqueda antes de volver a intentarlo.";
export const MASCOTA_UPDATE_UNKNOWN = "No se pudo confirmar el cambio. Conservamos tus datos; verificá la ficha antes de volver a guardar.";
export const MASCOTA_REMOTE_CHANGED = "Los datos cambiaron en el servidor. Podés cancelar para cargar la versión actual o guardar tus cambios.";

function writeError(error: unknown, creating: boolean): string {
  const status = statusOf(error);
  if (status === 400) return "No se pudieron guardar los datos. Revisá los campos e intentá nuevamente.";
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos para guardar estos datos.";
  if (!creating && status === 404) return "No se pudo guardar la mascota. Estamos verificando su ficha.";
  return creating ? MASCOTA_CREATE_UNKNOWN : MASCOTA_UPDATE_UNKNOWN;
}

/** Same orchestration used by React and Node tests; never writes flags, tenant or associations. */
export function createPetMascotaFormController(client: QueryClient, options: {
  localId: string;
  onSelect: (id: number) => void;
  onUnavailable: (id: number) => void;
  confirmDiscard: () => boolean;
}) {
  let state = initial();
  let selectedId: number | null = null;
  let generation = 0;
  let connected = true;
  const listeners = new Set<() => void>();
  const creation = new MutationObserver(client, createMascotaMutation(client, options.localId));
  const update = new MutationObserver(client, updateMascotaDataMutation(client, options.localId));
  const dirty = () => state.mode !== "viewing" && mascotaDraftDirty(state.original, state.draft);
  function snapshot() {
    return {
      ...state, dirty: dirty(), submitting: pending(state.mode),
      serverChanged: dirty() && state.remote !== null && !equalData(state.original, state.remote),
    };
  }
  let current = snapshot();
  function publish() {
    current = snapshot();
    for (const listener of listeners) listener();
  }
  const isCurrent = (token: number) => connected && generation === token;
  const canLeave = () => !pending(state.mode) && !state.checking && (!dirty() || options.confirmDiscard());
  function reset(notice: string | null = null, focus = false) {
    generation++;
    state = initial(state.focusDetail + (focus ? 1 : 0), notice);
  }

  function syncSelection(id: number | null, detail: PetManagementDetail | null) {
    let changed = false;
    if (id !== selectedId) {
      selectedId = id;
      // The previous pet may disappear during creation. Its GET says nothing about the new draft/POST.
      if (id !== null || (state.mode !== "creating" && state.mode !== "submittingCreate")) {
        reset();
        changed = true;
      }
    }
    if (detail?.id === id && state.mascotaId === id
      && (state.mode === "editing" || state.mode === "submittingEdit")) {
      const draft = detailToMascotaDraft(detail);
      const remote = normalizeMascotaDraft(draft);
      if (state.remote === null || !equalData(remote, state.remote)) {
        // A pristine draft follows the current remote snapshot. A dirty draft is never merged.
        state = !dirty() && !pending(state.mode)
          ? { ...state, remote, original: remote, draft }
          : { ...state, remote };
        changed = true;
      }
    }
    if (changed) publish();
  }

  async function verifyDetail() {
    const id = state.mascotaId;
    if (!connected || state.mode !== "editing" || id === null || !state.needsRefresh || state.checking) return;
    const token = generation;
    state = { ...state, checking: true };
    publish();
    try {
      // Do not mistake a GET started before the write for post-write verification.
      await client.cancelQueries({ queryKey: queryKeys.petManagement.detail(options.localId, id), exact: true });
      if (!isCurrent(token)) return;
      const detail = await client.fetchQuery(petManagementDetailQuery(options.localId, id));
      if (!isCurrent(token)) return;
      if (!detail) throw new PetManagementApiError(200, null);
      syncSelection(id, detail);
      state = {
        ...state, checking: false, needsRefresh: false,
        errorMessage: "No se pudo confirmar el cambio. La ficha se actualizó; revisá los datos antes de guardar nuevamente, o cancelá para cargar la versión actual.",
      };
      publish();
    } catch (error: unknown) {
      if (!isCurrent(token)) return;
      if (petManagementErrorKind(error, "detail") === "detail-not-found") {
        selectedId = null;
        reset("La mascota ya no está disponible.", true);
        options.onUnavailable(id);
      } else {
        state = { ...state, checking: false, errorMessage: `${MASCOTA_UPDATE_UNKNOWN} No pudimos verificar la ficha.` };
      }
      publish();
    }
  }

  async function submit(): Promise<boolean> {
    if (!connected || (state.mode !== "creating" && state.mode !== "editing") || state.needsRefresh || state.checking) return false;
    const errors = validateMascotaDraft(state.draft);
    state = { ...state, errors };
    if (Object.keys(errors).length > 0 || !dirty()) { publish(); return false; }
    const creating = state.mode === "creating";
    const id = state.mascotaId;
    if (!creating && id === null) return false;
    const data = normalizeMascotaDraft(state.draft);
    const patch = buildMascotaDataPatch(state.original, state.draft);
    const token = ++generation;
    state = { ...state, mode: creating ? "submittingCreate" : "submittingEdit", errorMessage: null };
    publish();
    try {
      const result = creating ? await creation.mutate(data) : await update.mutate({ id: id!, patch });
      if (!isCurrent(token)) return false;
      if (creating) {
        selectedId = result.id;
        options.onSelect(result.id);
      }
      reset(creating ? "Mascota creada. Consultando su ficha." : "Datos guardados.", true);
      publish();
      return true;
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const status = statusOf(error);
      const needsRefresh = !creating && ![400, 401, 403].includes(status);
      state = { ...state, mode: creating ? "creating" : "editing", errorMessage: writeError(error, creating), needsRefresh };
      publish();
      if (needsRefresh) await verifyDetail();
      return false;
    }
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => { connected = true; },
    disconnect: () => { connected = false; generation++; },
    syncSelection,
    beginCreate: () => {
      if (!canLeave()) return false;
      reset();
      state = { ...state, mode: "creating" };
      publish();
      return true;
    },
    beginEdit: (detail: PetManagementDetail) => {
      if (state.mode !== "viewing" || detail.id !== selectedId) return false;
      const draft = detailToMascotaDraft(detail);
      const original = normalizeMascotaDraft(draft);
      generation++;
      state = { ...initial(state.focusDetail), mode: "editing", mascotaId: detail.id, draft, original, remote: original };
      publish();
      return true;
    },
    change: (field: MascotaDataField, value: string) => {
      if (state.mode !== "creating" && state.mode !== "editing") return;
      state = { ...state, draft: { ...state.draft, [field]: value }, errors: { ...state.errors, [field]: undefined } };
      if (!dirty() && state.remote !== null) {
        // Once pristine, use the whole current remote version, never a field-by-field merge.
        const draft = Object.fromEntries(MASCOTA_DATA_FIELDS.map(key => [key, state.remote![key] ?? ""])) as MascotaFormDraft;
        state = { ...state, draft, original: state.remote };
      }
      publish();
    },
    cancel: () => {
      if (!canLeave()) return false;
      reset();
      publish();
      return true;
    },
    selectMascota: (id: number) => {
      if (id === selectedId && state.mode !== "creating") return false;
      if (!canLeave()) return false;
      reset();
      selectedId = id;
      options.onSelect(id);
      publish();
      return true;
    },
    submit,
    verifyDetail,
  };
}

export type PetMascotaFormController = ReturnType<typeof createPetMascotaFormController>;
export type PetMascotaFormSnapshot = ReturnType<PetMascotaFormController["getSnapshot"]>;
