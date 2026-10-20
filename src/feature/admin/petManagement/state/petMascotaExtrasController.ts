import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import type { PetExtra } from "../../petExtras/types/petExtras.types.ts";
import { petExtraWriteIsUncertain, petExtrasQuery } from "../../petExtras/queries/petExtrasQueries.ts";
import { PetExtrasApiError } from "../../petExtras/services/petExtras.service.ts";
import { invalidatePetMascotaExtras, petMascotaExtraMutation, petMascotaExtrasQuery, type PetMascotaExtraAction } from "../queries/petMascotaExtrasQueries.ts";
import { combinePetMascotaExtras, parsePetExtraDuracion, petMascotaExtrasError, type PetMascotaExtra } from "../types/petMascotaExtras.types.ts";

interface Draft { value: string; base: number | null; error: string | null }
interface State {
  drafts: Record<number, Draft>;
  busy: boolean;
  verification: PetMascotaExtraAction | null;
  errorMessage: string | null;
  notice: string | null;
}
const initial = (): State => ({ drafts: {}, busy: false, verification: null, errorMessage: null, notice: null });

/** Independent from the M.2 detail: only the submitted extra draft is reconciled after a write. */
export function createPetMascotaExtrasController(client: QueryClient, options: {
  localId: string;
  confirmRemove: (nombre: string) => boolean;
  confirmDiscard: () => boolean;
  canWrite?: () => boolean;
}) {
  let state = initial();
  let mascotaId: number | null = null;
  let catalogo: readonly PetExtra[] = [];
  let relaciones: readonly PetMascotaExtra[] = [];
  let ready = false;
  let generation = 0;
  let connected = true;
  const listeners = new Set<() => void>();
  const mutation = new MutationObserver(client, petMascotaExtraMutation(options.localId));
  const rows = () => combinePetMascotaExtras(catalogo, relaciones);
  const draftDirty = (draft: Draft) => draft.value !== (draft.base === null ? "" : String(draft.base));
  const snapshot = () => ({ ...state, mascotaId,
    dirty: state.verification !== null || Object.values(state.drafts).some(draftDirty),
    rows: rows().map(row => {
      const draft = state.drafts[row.id];
      return { ...row, value: draft?.value ?? (row.duracionAdicionalMinutos === null ? "" : String(row.duracionAdicionalMinutos)),
        error: draft?.error ?? null,
        serverChanged: Boolean(draft && draftDirty(draft) && draft.base !== row.duracionAdicionalMinutos) };
    }),
  });
  let current = snapshot();
  const publish = () => { current = snapshot(); for (const listener of listeners) listener(); };
  const isCurrent = (token: number) => connected && generation === token;
  const canWrite = () => connected && ready && mascotaId !== null && !state.busy && !state.verification && (options.canWrite?.() ?? true);

  function syncSelection(id: number | null) {
    if (mascotaId === id) return;
    mascotaId = id; generation++; state = initial(); relaciones = []; catalogo = []; ready = false; publish();
  }

  function syncData(id: number, catalog: readonly PetExtra[], relations: readonly PetMascotaExtra[]) {
    if (id !== mascotaId) return;
    catalogo = catalog; relaciones = relations; ready = true;
    // Pristine fields follow remote; dirty drafts retain their base for a remote-change warning.
    const drafts = { ...state.drafts };
    for (const [key, draft] of Object.entries(drafts)) if (!draftDirty(draft)) delete drafts[Number(key)];
    state = { ...state, drafts }; publish();
  }

  async function verify(action: PetMascotaExtraAction, token: number): Promise<boolean> {
    const id = mascotaId;
    if (id === null || !isCurrent(token)) return false;
    state = { ...state, busy: true, verification: action }; publish();
    try {
      // Cancel any read begun before the write: it cannot establish its outcome.
      await client.cancelQueries({ queryKey: queryKeys.petMascotaExtras.all(options.localId, id), exact: true });
      if (!isCurrent(token)) return false;
      const data = await client.fetchQuery(petMascotaExtrasQuery(options.localId, id));
      if (!isCurrent(token)) return false;
      relaciones = data;
      const relation = data.find(item => item.id === action.extraId);
      const confirmed = action.kind === "remove" ? !relation
        : Boolean(relation && (action.kind === "add" || relation.duracion_minutos === action.duracionMinutos));
      const unresolvedAdd = action.kind === "add" && !relation;
      const drafts = { ...state.drafts };
      if (!unresolvedAdd) delete drafts[action.extraId];
      state = { ...state, drafts, busy: false, verification: unresolvedAdd ? action : null,
        errorMessage: confirmed ? null : unresolvedAdd
          ? "No se pudo confirmar la asociación. El servidor todavía no muestra el extra. Conservamos los minutos adicionales ingresados; usá Verificar nuevamente para consultar sin reenviar."
          : "No se pudo confirmar el cambio solicitado. Mostramos la configuración actual del servidor; revisala antes de otro intento.",
        notice: confirmed ? action.kind === "remove" ? "Se quitó el extra de esta mascota. Sigue existiendo en el catálogo."
          : action.kind === "add" ? "Extra permitido. Tiempo adicional actualizado desde el servidor." : "Tiempo adicional actualizado desde el servidor." : null };
      publish();
      // Also invalidate consumers when an uncertain write was confirmed/reconciled by GET.
      await invalidatePetMascotaExtras(client, id);
      return confirmed;
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      state = { ...state, busy: false, errorMessage: `${petMascotaExtrasError(error)} No pudimos verificar el resultado. Verificá nuevamente antes de otra operación.` };
      publish(); return false;
    }
  }

  async function execute(action: PetMascotaExtraAction): Promise<boolean> {
    if (!canWrite() || mascotaId === null) return false;
    const id = mascotaId;
    const token = ++generation;
    state = { ...state, busy: true, errorMessage: null, notice: null }; publish();
    try {
      await mutation.mutate({ mascotaId: id, action });
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const status = error instanceof PetExtrasApiError ? error.status : 0;
      if (!petExtraWriteIsUncertain(error) && status !== 404 && status !== 409) {
        state = { ...state, busy: false, errorMessage: petMascotaExtrasError(error) }; publish(); return false;
      }
      if (status === 409) {
        // A remote deactivation may explain an association conflict; refresh only the catalog.
        await client.cancelQueries({ queryKey: queryKeys.petExtras.all(options.localId), exact: true });
        try {
          const data = await client.fetchQuery(petExtrasQuery(options.localId));
          if (isCurrent(token)) catalogo = data;
        } catch { /* Relationship verification still runs when catalog refresh fails. */ }
      }
    }
    return verify(action, token);
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => { connected = true; },
    disconnect: () => { connected = false; generation++; },
    syncSelection, syncData,
    change: (extraId: number, value: string) => {
      const row = rows().find(item => item.id === extraId);
      if (!row || !canWrite() || (!row.permitido && !row.activo)) return;
      const previous = state.drafts[extraId];
      const draft = { value, base: previous ? previous.base : row.duracionAdicionalMinutos, error: null };
      const drafts = { ...state.drafts };
      if (draftDirty(draft)) drafts[extraId] = draft;
      else delete drafts[extraId];
      state = { ...state, drafts };
      publish();
    },
    discard: (extraId: number) => {
      const draft = state.drafts[extraId];
      if (state.busy || state.verification || !draft || (draftDirty(draft) && !options.confirmDiscard())) return;
      const drafts = { ...state.drafts }; delete drafts[extraId]; state = { ...state, drafts }; publish();
    },
    save: async (extraId: number): Promise<boolean> => {
      const row = current.rows.find(item => item.id === extraId);
      if (!canWrite() || !row || (!row.permitido && !row.activo)) return false;
      const duration = parsePetExtraDuracion(row.value);
      if (duration === null) {
        state = { ...state, drafts: { ...state.drafts, [extraId]: { value: row.value,
          base: state.drafts[extraId] ? state.drafts[extraId].base : row.duracionAdicionalMinutos, error: "Ingresá un entero entre 1 y 2147483647 min." } } }; publish(); return false;
      }
      if (row.permitido && duration === row.duracionAdicionalMinutos) {
        const drafts = { ...state.drafts }; delete drafts[extraId];
        state = { ...state, drafts, notice: "El tiempo adicional no cambió. No se enviaron cambios." }; publish(); return true;
      }
      return execute({ kind: row.permitido ? "update" : "add", extraId, duracionMinutos: duration });
    },
    remove: async (extraId: number) => {
      const row = rows().find(item => item.id === extraId);
      if (!canWrite() || !row?.permitido || !options.confirmRemove(row.nombre)) return false;
      return execute({ kind: "remove", extraId });
    },
    verify: () => !state.busy && state.verification ? verify(state.verification, ++generation) : Promise.resolve(false),
  };
}

export type PetMascotaExtrasController = ReturnType<typeof createPetMascotaExtrasController>;
export type PetMascotaExtrasSnapshot = ReturnType<PetMascotaExtrasController["getSnapshot"]>;
