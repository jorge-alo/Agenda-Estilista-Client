import { MutationObserver, QueryObserver, type QueryClient } from "@tanstack/react-query";
import { PetAdminBookingApiError } from "../services/petAdminBooking.service.ts";
import type { PetAdminAvailabilityInput } from "../types/petAdminBooking.types.ts";
import {
  petAdminBookingReducer, petAdminCombineSuccess, petAdminInitialState, petAdminValidId,
  petAdminSuccessSnapshot, petAdminUsableOptions,
  type PetAdminBookingAction, type PetAdminSelectedSlot,
} from "./petAdminBookingState.ts";
import {
  invalidatePetAdminBookingAfterCreation, petAdminAvailabilityQuery, petAdminBookingErrorKind,
  petAdminCreationMutation, petAdminDetailQuery, petAdminExtrasQuery, petAdminSearchMascotasQuery, petAdminServiciosQuery,
} from "./petAdminBookingQueries.ts";

type ReadName = "search" | "detail" | "servicios" | "extras" | "availability";
type RecoveryKind = "mascota-stale" | "responsable-stale" | "servicio-stale" | "extra-stale" | "slot-conflict";
export interface PetAdminBookingIssue {
  kind: RecoveryKind | "unauthorized" | "forbidden" | "creation-unknown" | "invalid" | "read-error";
  source: ReadName | "create";
  status: number;
  code: string | null;
}

/** Admin orchestration shared by the hook and Node tests; no public session/storage/navigation. */
export function createPetAdminBookingController(client: QueryClient, options: { searchActive?: boolean } = {}) {
  let state = petAdminInitialState();
  let connected = false;
  let disposed = false;
  let syncing = false;
  let submitting = false;
  let unauthorized = false;
  let generation = 0;
  let initialDetailPending = false;
  let searchTerm = "";
  let searchActive = options.searchActive ?? false;
  let issue: PetAdminBookingIssue | null = null;
  let recovery: { kind: RecoveryKind; running: boolean } | null = null;
  const listeners = new Set<() => void>();
  const lastErrors = new Map<ReadName, unknown>();
  let subscriptions: Array<() => void> = [];

  const search = new QueryObserver(client, petAdminSearchMascotasQuery(""));
  const detail = new QueryObserver(client, petAdminDetailQuery(null, false));
  const servicios = new QueryObserver(client, petAdminServiciosQuery(null, false));
  const extras = new QueryObserver(client, petAdminExtrasQuery(null, false));
  const availability = new QueryObserver(client, petAdminAvailabilityQuery(null, false));
  const creation = new MutationObserver(client, petAdminCreationMutation());
  const reads = { search, detail, servicios, extras, availability };
  const canRead = () => connected && !disposed && !unauthorized && !state.success;
  const searchOptions = () => petAdminSearchMascotasQuery(searchTerm, 20, canRead() && searchActive);
  // The legacy detail endpoint has no code on 404. This exception is NEVER applied to other reads.
  const detailUnavailable = (error: unknown) => error instanceof PetAdminBookingApiError
    && ((error.status === 404 && (error.code === null || error.code === "PET_MASCOTA_NOT_FOUND"))
      || (error.status === 409 && error.code === "PET_MASCOTA_INACTIVA"));
  const selection = (): PetAdminAvailabilityInput | null => {
    const draft = state.draft;
    return draft.mascotaId === null || draft.servicioId === null ? null : {
      mascotaId: draft.mascotaId, servicioId: draft.servicioId, extraIds: [...draft.extraIds], fecha: draft.fecha,
    };
  };

  function submitSnapshot() {
    const d = detail.getCurrentResult();
    const s = servicios.getCurrentResult();
    const e = extras.getCurrentResult();
    const a = availability.getCurrentResult();
    if (!canRead() || submitting || recovery?.running || issue?.kind === "creation-unknown" || issue?.kind === "forbidden"
      || !d.isSuccess || !d.data || d.isFetching || !s.isSuccess || s.isFetching
      || !e.isSuccess || e.isFetching || !a.isSuccess || a.isFetching) return null;
    return petAdminSuccessSnapshot(state.draft, d.data, s.data, e.data, a.data);
  }

  function snapshot() {
    const p = search.getCurrentResult();
    const d = detail.getCurrentResult();
    const s = servicios.getCurrentResult();
    const e = extras.getCurrentResult();
    const mutation = creation.getCurrentResult();
    return {
      state,
      searchTerm,
      searchActive,
      searchResults: searchOptions().enabled && p.isSuccess && !p.isFetching ? p.data : [],
      searchLoading: searchOptions().enabled === true && p.isFetching,
      searchError: searchOptions().enabled && p.isError ? p.error : null,
      selectedPetDetail: d.isSuccess && d.data && d.data.id === state.draft.mascotaId ? d.data : null,
      responsables: d.data?.id === state.draft.mascotaId ? d.data.responsables : [],
      servicios: petAdminUsableOptions(s.data ?? []),
      extras: petAdminUsableOptions(e.data ?? []),
      queries: { search: p, detail: d, servicios: s, extras: e },
      availability: availability.getCurrentResult(),
      creation: { status: mutation.status, error: mutation.error },
      isSubmitting: submitting || mutation.isPending,
      isRecovering: recovery?.running === true,
      unauthorized,
      issue,
      notice: issue?.kind === "creation-unknown" ? "No pudimos confirmar el resultado de la reserva." : null,
      canConfirm: submitSnapshot() !== null,
    };
  }
  let current = snapshot();
  function publish() {
    current = snapshot();
    for (const listener of listeners) listener();
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      search.setOptions(searchOptions());
      // A detail may reset the pet. Rebind dependent observers before publishing that reset.
      for (let pass = 0; pass < 2; pass++) {
        const mascotaId = state.draft.mascotaId;
        detail.setOptions(petAdminDetailQuery(mascotaId, canRead()));
        const petDetail = detail.getCurrentResult();
        const active = canRead() && petDetail.isSuccess && petDetail.data !== undefined && !petDetail.isFetching
          && petDetail.data.id === mascotaId && petDetail.data.activo;
        servicios.setOptions(petAdminServiciosQuery(mascotaId, active));
        extras.setOptions(petAdminExtrasQuery(mascotaId, active));
        if (!submitting && !state.success) {
          const d = detail.getCurrentResult();
          const s = servicios.getCurrentResult();
          const e = extras.getCurrentResult();
          if (d.isSuccess && d.data && !d.isFetching) {
            state = petAdminBookingReducer(state, { type: "RECONCILE_DETAIL", detail: d.data, initial: initialDetailPending });
            initialDetailPending = false;
          } else if (d.isError && !d.isFetching && detailUnavailable(d.error) && mascotaId !== null) {
            state = petAdminBookingReducer(state, { type: "MASCOTA_UNAVAILABLE", mascotaId });
          }
          if (s.isSuccess && !s.isFetching) state = petAdminBookingReducer(state, { type: "RECONCILE_SERVICIOS", servicios: s.data });
          if (e.isSuccess && !e.isFetching) state = petAdminBookingReducer(state, { type: "RECONCILE_EXTRAS", extras: e.data });
        }
        if (state.draft.mascotaId === mascotaId) break;
        initialDetailPending = false;
      }
      const s = servicios.getCurrentResult();
      const e = extras.getCurrentResult();
      const d = detail.getCurrentResult();
      const ready = canRead() && d.isSuccess && d.data !== undefined && !d.isFetching && d.data.id === state.draft.mascotaId && d.data.activo
        && s.isSuccess && !s.isFetching && petAdminUsableOptions(s.data).some(item => item.id === state.draft.servicioId)
        && e.isSuccess && !e.isFetching && state.draft.extraIds.every(id => petAdminUsableOptions(e.data).some(item => item.id === id));
      // Responsible selection deliberately does not gate calendar reads.
      availability.setOptions(petAdminAvailabilityQuery(selection(), ready));
    } finally { syncing = false; }
    publish();
  }

  function clearIncident() { issue = null; recovery = null; }

  async function recover(kind: RecoveryKind) {
    if (!canRead() || submitting || recovery) return;
    const incident = { kind, running: true };
    recovery = incident;
    const attempt = generation;
    const mascotaId = state.draft.mascotaId;
    if (kind !== "responsable-stale") state = petAdminBookingReducer(state, { type: "CLEAR_SLOT" });
    sync();
    const alive = () => connected && !disposed && !unauthorized && generation === attempt && recovery === incident;
    // Mark before refetching: errors in the recovery reads cannot recursively start another recovery.
    if (kind === "mascota-stale") {
      if (alive() && state.draft.mascotaId === mascotaId && mascotaId !== null) await detail.refetch();
    } else if (kind === "responsable-stale") {
      if (mascotaId !== null) await detail.refetch();
    } else if (kind === "servicio-stale") {
      if (mascotaId !== null) await servicios.refetch();
    } else if (kind === "extra-stale") {
      if (mascotaId !== null) await extras.refetch();
    } else if (petAdminAvailabilityQuery(selection()).enabled) {
      await availability.refetch();
    }
    if (!alive()) return;
    incident.running = false;
    sync();
  }

  function handleError(error: unknown, source: ReadName | "create") {
    if (!connected || disposed) return;
    const kind = source === "detail" && detailUnavailable(error) ? "mascota-stale" : petAdminBookingErrorKind(error);
    // Search is a picker, never evidence about the selected pet or a reason to block a valid draft.
    if (source === "search" && kind !== "unauthorized") { sync(); return; }
    const status = error instanceof PetAdminBookingApiError ? error.status : 0;
    const code = error instanceof PetAdminBookingApiError ? error.code : null;
    issue = { kind: kind === "other" ? (source === "create" ? (status === 400 ? "invalid" : "creation-unknown") : "read-error") : kind,
      source, status, code };
    if (kind === "unauthorized") {
      // fetchWithAuth already cleared the JWT and redirected. Do not access storage or restore identity here.
      unauthorized = true;
      for (const observer of Object.values(reads)) void client.cancelQueries({ queryKey: observer.getCurrentQuery().queryKey, exact: true });
    } else if (source === "detail" && detailUnavailable(error)) {
      // This read already confirmed invalidity; reconcile it without refetching the same failure in a loop.
    } else if (kind !== "other" && kind !== "forbidden") {
      void recover(kind);
    }
    sync();
  }

  function queryChanged(name: ReadName) {
    if (!connected || syncing) return;
    const result = reads[name].getCurrentResult();
    if (result.isFetching) lastErrors.delete(name);
    else if (result.isError && lastErrors.get(name) !== result.error) {
      lastErrors.set(name, result.error);
      handleError(result.error, name);
    }
    sync();
  }

  function stop() {
    connected = false;
    generation++;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    creation.reset();
    recovery = null;
    // Unsubscribing the last QueryObserver cancels its consumed signal; mutation is never cancelled.
  }

  function select(action: PetAdminBookingAction) {
    if (disposed || submitting || unauthorized || state.success) return;
    const next = petAdminBookingReducer(state, action);
    if (next === state) return;
    if (next.draft.mascotaId !== state.draft.mascotaId) initialDetailPending = next.draft.mascotaId !== null;
    state = next;
    clearIncident();
    creation.reset();
    sync();
  }

  async function refetch(name: ReadName) {
    if (!canRead() || submitting || (name === "search" ? !searchOptions().enabled : state.draft.mascotaId === null)
      || (name === "availability" && !petAdminAvailabilityQuery(selection()).enabled)) return;
    if (name !== "search") clearIncident();
    publish();
    await reads[name].refetch();
  }

  function setSearchActive(active: boolean) {
    if (disposed || submitting || unauthorized || state.success || searchActive === active) return;
    searchActive = active;
    sync();
    if (!active) resetInactiveSearch();
  }

  function resetInactiveSearch() {
    // Reset only this disabled observer's exact key, never a cache observed by another consumer.
    const query = search.getCurrentQuery();
    if (query.getObserversCount() === 1) void client.resetQueries({ queryKey: query.queryKey, exact: true });
  }

  function clearSearch() {
    if (disposed || submitting || unauthorized || state.success) return;
    searchTerm = "";
    searchActive = false;
    sync();
    resetInactiveSearch();
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      if (disposed) return () => {};
      listeners.add(listener);
      if (!connected) {
        connected = true;
        syncing = true;
        try {
          subscriptions = (Object.entries(reads) as Array<[ReadName, typeof reads[ReadName]]>)
            .map(([name, observer]) => observer.subscribe(() => queryChanged(name)));
          subscriptions.push(creation.subscribe(() => { if (!syncing) publish(); }));
        } finally { syncing = false; }
        sync();
      }
      return () => { listeners.delete(listener); if (listeners.size === 0) stop(); };
    },
    setMascota: (mascotaId: number | null) => {
      const results = search.getCurrentResult();
      if (mascotaId === null || (petAdminValidId(mascotaId) && searchOptions().enabled && results.isSuccess
        && !results.isFetching && results.data.some(item => item.id === mascotaId))) {
        select({ type: "SET_MASCOTA", mascotaId });
      }
    },
    setCliente: (clienteId: number | null) => {
      if (clienteId === null || detail.getCurrentResult().data?.responsables.some(item => item.clienteId === clienteId)) select({ type: "SET_CLIENTE", clienteId });
    },
    setServicio: (servicioId: number | null) => {
      if (servicioId === null || petAdminUsableOptions(servicios.getCurrentResult().data ?? []).some(item => item.id === servicioId)) select({ type: "SET_SERVICIO", servicioId });
    },
    toggleExtra: (extraId: number) => {
      if (state.draft.extraIds.includes(extraId) || petAdminUsableOptions(extras.getCurrentResult().data ?? []).some(item => item.id === extraId)) select({ type: "TOGGLE_EXTRA", extraId });
    },
    setFecha: (fecha: string) => select({ type: "SET_FECHA", fecha }),
    setSlot: (slot: PetAdminSelectedSlot) => {
      const a = availability.getCurrentResult();
      if (!canRead() || !a.isSuccess || a.isFetching || !a.data.slots.some(item => item.horaInicio === slot.horaInicio && item.horaFin === slot.horaFin)) return;
      select({ type: "SET_SLOT", slot });
    },
    setSearchTerm: (term: string) => {
      if (disposed || submitting || unauthorized || state.success || term.trim() === searchTerm) return;
      searchTerm = term.trim();
      sync();
    },
    setSearchActive,
    clearSearch,
    refetchSearch: () => refetch("search"),
    refetchDetail: () => refetch("detail"),
    refetchServicios: () => refetch("servicios"),
    refetchExtras: () => refetch("extras"),
    refetchAvailability: () => refetch("availability"),
    startNewBooking: () => {
      if (disposed || submitting || unauthorized) return;
      state = petAdminInitialState();
      initialDetailPending = false;
      clearIncident();
      creation.reset();
      clearSearch();
    },
    confirmar: async (): Promise<"created" | "ignored" | "error"> => {
      const base = submitSnapshot();
      const input = selection();
      const draft = state.draft;
      if (!base || !input || draft.clienteId === null || !draft.slotSeleccionado) return "ignored";
      submitting = true; // Synchronous, independent of MutationObserver notification/React render.
      const attempt = generation;
      const command = { ...input, clienteId: draft.clienteId, hora: draft.slotSeleccionado.horaInicio };
      clearIncident();
      publish();
      try {
        const created = await creation.mutate(command);
        if (connected && !disposed && generation === attempt) {
          state = petAdminBookingReducer(state, { type: "SUCCESS", success: petAdminCombineSuccess(base, created) });
          sync();
        }
        // A successful POST also affects the agenda if this controller has since unmounted.
        await invalidatePetAdminBookingAfterCreation(client, input);
        return "created";
      } catch (error: unknown) {
        submitting = false; // Recovery must see a settled POST, never the in-flight submit guard.
        if (connected && !disposed && generation === attempt) handleError(error, "create");
        return "error";
      } finally {
        submitting = false;
        if (connected && !disposed && generation === attempt) sync();
      }
    },
    suspend: stop,
    dispose: () => { disposed = true; stop(); listeners.clear(); },
  };
}
