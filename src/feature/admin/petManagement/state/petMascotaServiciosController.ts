import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import type { PetServicio } from "../../petServicios/types/petServicios.types.ts";
import { petServicioWriteIsUncertain } from "../../petServicios/queries/petServiciosQueries.ts";
import { PetServiciosApiError } from "../../petServicios/services/petServicios.service.ts";
import { petServiciosQuery } from "../../petServicios/queries/petServiciosQueries.ts";
import { invalidatePetMascotaServicios, petMascotaServicioMutation, petMascotaServiciosQuery, type PetMascotaServicioAction } from "../queries/petMascotaServiciosQueries.ts";
import { combinePetMascotaServicios, parsePetDuracion, petMascotaServiciosError, type PetMascotaServicio } from "../types/petMascotaServicios.types.ts";

interface Draft { value: string; base: number | null; error: string | null }
interface State {
  drafts: Record<number, Draft>;
  busy: boolean;
  verification: PetMascotaServicioAction | null;
  errorMessage: string | null;
  notice: string | null;
}
const initial = (): State => ({ drafts: {}, busy: false, verification: null, errorMessage: null, notice: null });

/** Independent from the M.2 detail: only the submitted service draft is reconciled after a write. */
export function createPetMascotaServiciosController(client: QueryClient, options: {
  localId: string;
  confirmRemove: (nombre: string) => boolean;
  confirmDiscard: () => boolean;
  canWrite?: () => boolean;
}) {
  let state = initial();
  let mascotaId: number | null = null;
  let catalogo: readonly PetServicio[] = [];
  let relaciones: readonly PetMascotaServicio[] = [];
  let ready = false;
  let generation = 0;
  let connected = true;
  const listeners = new Set<() => void>();
  const mutation = new MutationObserver(client, petMascotaServicioMutation(options.localId));
  const rows = () => combinePetMascotaServicios(catalogo, relaciones);
  const draftDirty = (draft: Draft) => draft.value !== (draft.base === null ? "" : String(draft.base));
  const snapshot = () => ({ ...state, mascotaId,
    dirty: state.verification !== null || Object.values(state.drafts).some(draftDirty),
    rows: rows().map(row => {
      const draft = state.drafts[row.id];
      return { ...row, value: draft?.value ?? (row.duracionMinutos === null ? "" : String(row.duracionMinutos)),
        error: draft?.error ?? null,
        serverChanged: Boolean(draft && draftDirty(draft) && draft.base !== row.duracionMinutos) };
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

  function syncData(id: number, catalog: readonly PetServicio[], relations: readonly PetMascotaServicio[]) {
    if (id !== mascotaId) return;
    catalogo = catalog; relaciones = relations; ready = true;
    // Pristine fields follow remote; dirty drafts retain their base for a remote-change warning.
    const drafts = { ...state.drafts };
    for (const [key, draft] of Object.entries(drafts)) if (!draftDirty(draft)) delete drafts[Number(key)];
    state = { ...state, drafts }; publish();
  }

  async function verify(action: PetMascotaServicioAction, token: number): Promise<boolean> {
    const id = mascotaId;
    if (id === null || !isCurrent(token)) return false;
    state = { ...state, busy: true, verification: action }; publish();
    try {
      // Cancel any read begun before the write: it cannot establish its outcome.
      await client.cancelQueries({ queryKey: queryKeys.petMascotaServicios.all(options.localId, id), exact: true });
      if (!isCurrent(token)) return false;
      const data = await client.fetchQuery(petMascotaServiciosQuery(options.localId, id));
      if (!isCurrent(token)) return false;
      relaciones = data;
      const relation = data.find(item => item.id === action.servicioId);
      const confirmed = action.kind === "remove" ? !relation
        : Boolean(relation && (action.kind === "add" || relation.duracion_minutos === action.duracionMinutos));
      const unresolvedAdd = action.kind === "add" && !relation;
      const drafts = { ...state.drafts };
      if (!unresolvedAdd) delete drafts[action.servicioId];
      state = { ...state, drafts, busy: false, verification: unresolvedAdd ? action : null,
        errorMessage: confirmed ? null : unresolvedAdd
          ? "No se pudo confirmar la asociación. El servidor todavía no muestra la relación. Conservamos la duración ingresada; usá Verificar nuevamente para consultar sin reenviar."
          : "No se pudo confirmar el cambio solicitado. Mostramos la configuración actual del servidor; revisala antes de otro intento.",
        notice: confirmed ? action.kind === "remove" ? "Se quitó el servicio de esta mascota. Sigue existiendo en el catálogo."
          : action.kind === "add" ? "Servicio permitido. Duración actualizada desde el servidor." : "Duración actualizada desde el servidor." : null };
      publish();
      // Also invalidate consumers when an uncertain write was confirmed/reconciled by GET.
      await invalidatePetMascotaServicios(client, id);
      return confirmed;
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      state = { ...state, busy: false, errorMessage: `${petMascotaServiciosError(error)} No pudimos verificar el resultado. Verificá nuevamente antes de otra operación.` };
      publish(); return false;
    }
  }

  async function execute(action: PetMascotaServicioAction): Promise<boolean> {
    if (!canWrite() || mascotaId === null) return false;
    const id = mascotaId;
    const token = ++generation;
    state = { ...state, busy: true, errorMessage: null, notice: null }; publish();
    try {
      await mutation.mutate({ mascotaId: id, action });
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const status = error instanceof PetServiciosApiError ? error.status : 0;
      if (!petServicioWriteIsUncertain(error) && status !== 404 && status !== 409) {
        state = { ...state, busy: false, errorMessage: petMascotaServiciosError(error) }; publish(); return false;
      }
      if (status === 409) {
        // A remote deactivation may explain an association conflict; refresh only the catalog.
        await client.cancelQueries({ queryKey: queryKeys.petServicios.all(options.localId), exact: true });
        try {
          const data = await client.fetchQuery(petServiciosQuery(options.localId));
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
    change: (servicioId: number, value: string) => {
      const row = rows().find(item => item.id === servicioId);
      if (!row || !canWrite() || (!row.permitido && !row.activo)) return;
      const previous = state.drafts[servicioId];
      const draft = { value, base: previous ? previous.base : row.duracionMinutos, error: null };
      const drafts = { ...state.drafts };
      if (draftDirty(draft)) drafts[servicioId] = draft;
      else delete drafts[servicioId];
      state = { ...state, drafts };
      publish();
    },
    discard: (servicioId: number) => {
      const draft = state.drafts[servicioId];
      if (state.busy || state.verification || !draft || (draftDirty(draft) && !options.confirmDiscard())) return;
      const drafts = { ...state.drafts }; delete drafts[servicioId]; state = { ...state, drafts }; publish();
    },
    save: async (servicioId: number): Promise<boolean> => {
      const row = current.rows.find(item => item.id === servicioId);
      if (!canWrite() || !row || (!row.permitido && !row.activo)) return false;
      const duration = parsePetDuracion(row.value);
      if (duration === null) {
        state = { ...state, drafts: { ...state.drafts, [servicioId]: { value: row.value,
          base: state.drafts[servicioId] ? state.drafts[servicioId].base : row.duracionMinutos, error: "Ingresá un entero entre 1 y 2147483647 min." } } }; publish(); return false;
      }
      if (row.permitido && duration === row.duracionMinutos) {
        const drafts = { ...state.drafts }; delete drafts[servicioId];
        state = { ...state, drafts, notice: "La duración no cambió. No se enviaron cambios." }; publish(); return true;
      }
      return execute({ kind: row.permitido ? "update" : "add", servicioId, duracionMinutos: duration });
    },
    remove: async (servicioId: number) => {
      const row = rows().find(item => item.id === servicioId);
      if (!canWrite() || !row?.permitido || !options.confirmRemove(row.nombre)) return false;
      return execute({ kind: "remove", servicioId });
    },
    verify: () => !state.busy && state.verification ? verify(state.verification, ++generation) : Promise.resolve(false),
  };
}

export type PetMascotaServiciosController = ReturnType<typeof createPetMascotaServiciosController>;
export type PetMascotaServiciosSnapshot = ReturnType<PetMascotaServiciosController["getSnapshot"]>;
