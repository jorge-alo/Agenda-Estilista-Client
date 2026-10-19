import { MutationObserver, QueryObserver, type QueryClient } from "@tanstack/react-query";
import type { PetProfileRefreshResult, PetPublicProfile } from "../session/publicPetSession.service.ts";
import { PublicPetHttpError } from "../services/publicPetHttp.ts";
import type { PetBookingOptions, PetCreatedBooking } from "../types/publicPetBooking.types.ts";
import {
  combinarPetBookingSuccess, crearEstadoInicialBooking, crearPetBookingSuccessBase, petBookingReducer,
  petBookingSelectionKey, type PetBookingAction, type PetBookingPet, type PetBookingSelectedSlot,
} from "./publicPetBookingState.ts";
import {
  PET_BOOKING_CREATE_UNKNOWN_MESSAGE, PET_BOOKING_EXTRA_CHANGED_MESSAGE, PET_BOOKING_INVALID_MESSAGE,
  PET_BOOKING_PET_CHANGED_MESSAGE, PET_BOOKING_SERVICE_CHANGED_MESSAGE, PET_BOOKING_TOO_MANY_MESSAGE,
} from "./publicPetBookingView.ts";
import {
  petBookingAvailabilityQuery, petBookingCreationMutation, petBookingErrorKind, petBookingOptionsQuery,
  removePetBookingQueries, type PetBookingScope, type ScopedPetBookingContext, type PetBookingSubmission,
} from "./publicPetBookingQueries.ts";

/** The same observer orchestration is used by React and by Node tests; no storage/navigation here. */
export function createPetBookingController(client: QueryClient, suppliedContext: ScopedPetBookingContext) {
  const context = { ...suppliedContext };
  const scope: PetBookingScope = { slug: context.slug, sessionScope: context.sessionScope };
  let state = crearEstadoInicialBooking([]);
  let pets: PetBookingPet[] = [];
  let initialized = false;
  let connected = false;
  let disposed = false;
  let syncing = false;
  let submitting = false;
  let sessionInvalid = false;
  let generation = 0;
  let onSessionInvalid: ((scope: PetBookingScope) => void) | undefined;
  const listeners = new Set<() => void>();
  let subscriptions: Array<() => void> = [];
  let lastOptionsError: unknown;
  let lastAvailabilityError: unknown;
  let notice: string | null = null;
  let recovery: { key: string; stage: "running" | "settled" } | null = null;
  let refreshProfile: (() => Promise<PetProfileRefreshResult>) | undefined;

  const options = new QueryObserver(client, petBookingOptionsQuery(context, null, false));
  const availability = new QueryObserver(client, petBookingAvailabilityQuery(context, null, false));
  const creation = new MutationObserver<PetCreatedBooking, Error, PetBookingSubmission>(client, petBookingCreationMutation(context));

  const canRead = () => connected && initialized && !sessionInvalid && !state.bookingUnavailable && !state.success;
  const input = () => state.draft.mascotaId === null || state.draft.servicioId === null ? null : ({
    mascotaId: state.draft.mascotaId, servicioId: state.draft.servicioId,
    extraIds: [...state.draft.extraIds], fecha: state.draft.fecha,
  });

  function submitSnapshot() {
    const c = options.getCurrentResult();
    const d = availability.getCurrentResult();
    if (!canRead() || submitting || !c.isSuccess || c.isFetching || !d.isSuccess || d.isFetching) return null;
    return crearPetBookingSuccessBase(state.draft, pets, c.data, d.data);
  }

  function snapshot() {
    const mutation = creation.getCurrentResult();
    return {
      state,
      options: options.getCurrentResult(),
      availability: availability.getCurrentResult(),
      creation: { status: mutation.status, error: mutation.error, data: mutation.data, isPending: submitting || mutation.isPending },
      sessionInvalid,
      notice,
      canConfirm: submitSnapshot() !== null,
    };
  }
  let current = snapshot();

  function publish() {
    current = snapshot();
    for (const listener of listeners) listener();
  }

  function sync(work?: () => void) {
    if (syncing) return;
    syncing = true;
    try {
      work?.();
      options.setOptions(petBookingOptionsQuery(context, state.draft.mascotaId, canRead()));
      const c = options.getCurrentResult();
      availability.setOptions(petBookingAvailabilityQuery(context, input(), canRead() && c.isSuccess && !c.isFetching));
    } finally { syncing = false; }
    publish();
  }

  function clearRecovery() {
    recovery = null;
    notice = null;
  }

  function recoveryKey(kind: string): string {
    const draft = state.draft;
    return JSON.stringify([kind, "pet-booking-recovery-v1", draft.mascotaId, draft.servicioId, [...draft.extraIds], draft.fecha]);
  }

  async function refetchOptionsGuarded(): Promise<PetBookingOptions | undefined> {
    const mascotaId = state.draft.mascotaId;
    if (mascotaId === null || submitting || petBookingOptionsQuery(context, mascotaId).enabled !== true) return undefined;
    const attempt = generation;
    const result = await options.refetch();
    return connected && generation === attempt && state.draft.mascotaId === mascotaId && result.isSuccess ? result.data : undefined;
  }

  /** At most one automatic recovery per stale incident; the marker stays until the user acts. */
  async function attemptRecovery(kind: "pet-unavailable" | "service-unavailable" | "extra-unavailable") {
    if (!connected || disposed || submitting) return;
    const key = recoveryKey(kind);
    if (recovery?.key === key) return;
    const attempt: { key: string; stage: "running" | "settled" } = { key, stage: "running" };
    recovery = attempt;
    notice = null;
    publish();
    const alive = () => connected && !disposed && recovery === attempt;
    let recovered = false;
    if (kind === "pet-unavailable") {
      const refresh = refreshProfile;
      const petId = state.draft.mascotaId;
      if (!refresh || petId === null) {
        if (alive()) { attempt.stage = "settled"; publish(); }
        return;
      }
      const result = await refresh();
      if (!alive()) return;
      if (result.status !== "refreshed") {
        attempt.stage = "settled";
        publish();
        return;
      }
      if (!result.profile.mascotas.some(pet => pet.id === petId)) {
        notice = PET_BOOKING_PET_CHANGED_MESSAGE;
        attempt.stage = "settled";
        publish();
        sync();
        return;
      }
      recovered = (await refetchOptionsGuarded()) !== undefined;
    } else {
      recovered = (await refetchOptionsGuarded()) !== undefined;
    }
    if (!alive()) return;
    attempt.stage = "settled";
    if (recovered) {
      notice = kind === "service-unavailable" ? PET_BOOKING_SERVICE_CHANGED_MESSAGE : PET_BOOKING_EXTRA_CHANGED_MESSAGE;
    }
    publish();
    sync();
  }

  function handleError(error: unknown, source: "read" | "create") {
    if (!connected || disposed) return;
    const kind = petBookingErrorKind(error);
    if (kind === "session-invalid") {
      if (!sessionInvalid) {
        const attempt = generation;
        sync(() => {
          sessionInvalid = true;
          void removePetBookingQueries(client, scope);
        });
        // F.4 must compare this non-secret scope with its current session before invalidating it.
        if (connected && !disposed && generation === attempt) onSessionInvalid?.({ ...scope });
      }
      return;
    }
    if (kind === "booking-unavailable") {
      if (!state.bookingUnavailable) {
        clearRecovery();
        sync(() => {
          state = petBookingReducer(state, { type: "BOOKING_UNAVAILABLE" });
          void removePetBookingQueries(client, scope);
        });
      }
      return;
    }
    if (kind === "slot-conflict") return;
    if (kind === "pet-unavailable" || kind === "service-unavailable" || kind === "extra-unavailable") {
      void attemptRecovery(kind);
      return;
    }
    const status = error instanceof PublicPetHttpError ? error.status : 0;
    if (status === 429) {
      notice = PET_BOOKING_TOO_MANY_MESSAGE;
      publish();
      return;
    }
    if (source === "create") {
      notice = status === 400 ? PET_BOOKING_INVALID_MESSAGE : PET_BOOKING_CREATE_UNKNOWN_MESSAGE;
      publish();
    }
  }

  function queryChanged(which: "options" | "availability") {
    if (!connected || syncing) return;
    const result = which === "options" ? options.getCurrentResult() : availability.getCurrentResult();
    if (result.isFetching) {
      if (which === "options") lastOptionsError = undefined; else lastAvailabilityError = undefined;
    } else if (result.isError) {
      const last = which === "options" ? lastOptionsError : lastAvailabilityError;
      if (last !== result.error) {
        if (which === "options") lastOptionsError = result.error; else lastAvailabilityError = result.error;
        handleError(result.error, "read");
      }
    }
    sync();
  }

  function stop() {
    connected = false;
    generation++;
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    creation.reset();
    clearRecovery();
    void removePetBookingQueries(client, scope);
  }

  function select(action: PetBookingAction) {
    if (disposed || submitting || sessionInvalid) return;
    const next = petBookingReducer(state, action);
    if (next === state) return;
    state = next;
    creation.reset();
    sync();
  }

  /** User intent invalidates the stale incident; automatic reconciliation (RECONCILE_*) goes through select(). */
  function userSelect(action: PetBookingAction) {
    const hadRecovery = recovery !== null || notice !== null;
    const before = state;
    clearRecovery();
    select(action);
    if (hadRecovery && state === before) publish();
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
          options.setOptions(petBookingOptionsQuery(context, state.draft.mascotaId, canRead()));
          subscriptions = [
            options.subscribe(() => queryChanged("options")),
            availability.subscribe(() => queryChanged("availability")),
            creation.subscribe(() => { if (!syncing) publish(); }),
          ];
        } finally { syncing = false; }
        sync();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    setOnSessionInvalid: (callback: ((value: PetBookingScope) => void) | undefined) => { onSessionInvalid = callback; },
    setRefreshProfile: (callback: (() => Promise<PetProfileRefreshResult>) | undefined) => { refreshProfile = callback; },
    setProfile: (profile: Pick<PetPublicProfile, "mascotas">) => {
      if (disposed) return;
      if (initialized && pets.length === profile.mascotas.length
        && pets.every((pet, index) => pet.id === profile.mascotas[index].id && pet.nombre === profile.mascotas[index].nombre)) return;
      pets = profile.mascotas.map(pet => ({ id: pet.id, nombre: pet.nombre }));
      if (!initialized) { state = crearEstadoInicialBooking(pets); initialized = true; }
      else if (!submitting && !state.success) state = petBookingReducer(state, { type: "RECONCILE_PROFILE", mascotas: pets });
      sync();
    },
    setMascota: (mascotaId: number | null) => userSelect({ type: "SET_MASCOTA", mascotaId }),
    setServicio: (servicioId: number | null) => userSelect({ type: "SET_SERVICIO", servicioId }),
    toggleExtra: (extraId: number) => userSelect({ type: "TOGGLE_EXTRA", extraId }),
    setFecha: (fecha: string) => userSelect({ type: "SET_FECHA", fecha }),
    setSlot: (slot: PetBookingSelectedSlot) => {
      const result = availability.getCurrentResult();
      const catalog = options.getCurrentResult();
      if (!canRead() || result.isFetching || !result.isSuccess
        || !catalog.isSuccess || catalog.isFetching
        || !result.data.slots.some(item => item.horaInicio === slot.horaInicio && item.horaFin === slot.horaFin)) return;
      userSelect({ type: "SET_SLOT", slot });
    },
    reconcileOptions: (mascotaId: number, value: PetBookingOptions) => {
      if (mascotaId === state.draft.mascotaId) select({ type: "RECONCILE_OPTIONS", opciones: value });
    },
    refetchOptions: async () => {
      if (!canRead() || submitting || petBookingOptionsQuery(context, state.draft.mascotaId).enabled !== true) return undefined;
      clearRecovery();
      publish();
      return refetchOptionsGuarded();
    },
    refetchAvailability: async () => {
      if (!canRead() || submitting || petBookingAvailabilityQuery(context, input()).enabled !== true) return undefined;
      clearRecovery();
      publish();
      const key = petBookingSelectionKey(state.draft);
      const attempt = generation;
      const result = await availability.refetch();
      return connected && generation === attempt && petBookingSelectionKey(state.draft) === key && result.isSuccess ? result.data : undefined;
    },
    retryBooking: () => {
      if (disposed || submitting || sessionInvalid || !state.bookingUnavailable) return;
      lastOptionsError = undefined;
      lastAvailabilityError = undefined;
      creation.reset();
      clearRecovery();
      state = petBookingReducer(state, { type: "RETRY_BOOKING" });
      sync();
    },
    startNewBooking: () => {
      if (state.bookingUnavailable) return;
      userSelect({ type: "START_NEW_BOOKING", mascotas: pets });
    },
    confirmar: async (): Promise<"created" | "ignored" | "error"> => {
      const base = submitSnapshot();
      const selection = input();
      const slot = state.draft.slotSeleccionado;
      if (!base || !selection || !slot) return "ignored";
      // A synchronous guard, independent of React's next render/MutationObserver notification.
      submitting = true;
      const attempt = generation;
      const command: PetBookingSubmission = { input: { ...selection, hora: slot.horaInicio }, snapshot: base };
      clearRecovery();
      publish();
      try {
        const created = await creation.mutate(command);
        if (connected && !disposed && generation === attempt) {
          sync(() => {
            state = petBookingReducer(state, { type: "SET_SUCCESS", success: combinarPetBookingSuccess(base, created) });
            void removePetBookingQueries(client, scope);
          });
        }
        return "created";
      } catch (error: unknown) {
        // The POST has settled; recovery must not be blocked by the submit guard.
        submitting = false;
        if (connected && !disposed && generation === attempt) {
          handleError(error, "create");
          if (petBookingErrorKind(error) === "slot-conflict" && canRead()) {
            clearRecovery();
            state = petBookingReducer(state, { type: "SLOT_CONFLICT" });
            sync();
            await client.invalidateQueries({ queryKey: petBookingAvailabilityQuery(context, selection).queryKey, exact: true });
          }
        }
        return "error";
      } finally {
        submitting = false;
        if (connected && !disposed && generation === attempt) sync();
      }
    },
    // Reversible for StrictMode's subscribe/cleanup replay; a stopped generation
    // never emits late mutation events even if this controller later reconnects.
    suspend: stop,
    dispose: () => { disposed = true; onSessionInvalid = undefined; refreshProfile = undefined; stop(); listeners.clear(); },
  };
}
