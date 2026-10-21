import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys.ts";
import { mascotaFlagAppliedMessage, mascotaFlagBlockedReason, mascotaOnlineErrorMessage, MASCOTA_FLAG_UNKNOWN } from "../components/petMascotaFlagsView.ts";
import { updateMascotaFlagMutation } from "../mutations/petMascotaFlagsMutations.ts";
import { petManagementDetailQuery } from "../queries/petManagementQueries.ts";
import { PetManagementApiError } from "../services/petManagement.service.ts";
import { MASCOTA_FLAGS, type MascotaFlag, type MascotaFlagChange } from "../types/petMascotaFlags.types.ts";
import type { PetManagementDetail } from "../types/petManagement.types.ts";

interface State {
  mode: "idle" | "writing" | "checking";
  pending: MascotaFlagChange | null;
  errorMessage: string | null;
  notice: string | null;
}
const initial = (): State => ({ mode: "idle", pending: null, errorMessage: null, notice: null });
const statusOf = (error: unknown) => error instanceof PetManagementApiError ? error.status : 0;
function knownError(error: unknown): string | null {
  if (statusOf(error) === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (statusOf(error) === 403) return "No tenés permisos para cambiar estos flags.";
  if (statusOf(error) === 400) return "No pudimos validar el cambio. Actualizá la ficha antes de volver a intentarlo.";
  if (error instanceof PetManagementApiError && error.status === 409) return mascotaOnlineErrorMessage(error.code);
  return null;
}

/** Separate from Datos/Responsables. A single synchronous lock covers PATCH and contextual verification. */
export function createPetMascotaFlagsController(client: QueryClient, options: {
  localId: string;
  confirmChange: (change: MascotaFlagChange, detail: PetManagementDetail) => boolean;
  onUnavailable: (id: number) => void;
  canChange?: () => boolean;
}) {
  let state = initial();
  let selectedId: number | null = null;
  let remote: PetManagementDetail | null = null;
  let connected = true;
  let generation = 0;
  const listeners = new Set<() => void>();
  const mutation = new MutationObserver(client, updateMascotaFlagMutation(client, options.localId));
  const snapshot = () => ({ ...state, busy: state.mode !== "idle", dirty: state.pending !== null });
  let current = snapshot();
  const publish = () => { current = snapshot(); for (const listener of listeners) listener(); };
  const isCurrent = (token: number) => connected && generation === token;

  function syncSelection(id: number | null, detail: PetManagementDetail | null) {
    if (id !== selectedId) {
      selectedId = id;
      generation++;
      state = initial();
      remote = detail?.id === id ? detail : null;
      publish();
    } else remote = detail?.id === id ? detail : null;
  }

  async function verify(change: MascotaFlagChange, token: number): Promise<boolean> {
    const mascotaId = selectedId;
    if (!isCurrent(token) || mascotaId === null) return false;
    state = { ...state, mode: "checking", pending: change };
    publish();
    try {
      // Cancel pre-write reads before fetching the authoritative post-write detail.
      await client.cancelQueries({ queryKey: queryKeys.petManagement.detail(options.localId, mascotaId), exact: true });
      if (!isCurrent(token)) return false;
      const detail = await client.fetchQuery(petManagementDetailQuery(options.localId, mascotaId));
      if (!isCurrent(token)) return false;
      if (!detail) throw new PetManagementApiError(200, null);
      remote = detail;
      const applied = detail[change.flag] === change.value;
      state = { ...initial(), notice: applied ? mascotaFlagAppliedMessage(change) : null,
        errorMessage: applied ? null : "La ficha sigue mostrando el estado anterior. El cambio no quedó confirmado; podés reintentarlo explícitamente." };
      publish();
      return applied;
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      if (statusOf(error) === 404) {
        selectedId = null;
        remote = null;
        generation++;
        state = { ...initial(), notice: "La mascota ya no está disponible." };
        options.onUnavailable(mascotaId);
      } else state = { ...state, mode: "idle", errorMessage: knownError(error) ?? MASCOTA_FLAG_UNKNOWN };
      publish();
      return false;
    }
  }

  async function changeFlag(flag: MascotaFlag, value: boolean): Promise<boolean> {
    if (!connected || selectedId === null || !remote || remote.id !== selectedId || state.mode !== "idle" || state.pending
      || options.canChange?.() === false || !MASCOTA_FLAGS.includes(flag) || typeof value !== "boolean") return false;
    const change = { flag, value };
    const blocked = mascotaFlagBlockedReason(remote, change);
    if (blocked) { state = { ...state, notice: blocked, errorMessage: null }; publish(); return false; }
    if (remote[flag] === value) return false;
    if (((flag === "activo" && !value) || flag === "reservaOnlineHabilitada") && !options.confirmChange(change, remote)) return false;
    const mascotaId = selectedId;
    const token = ++generation;
    state = { mode: "writing", pending: change, errorMessage: null, notice: null };
    publish();
    try {
      await mutation.mutate({ mascotaId, change });
    } catch (error: unknown) {
      if (!isCurrent(token)) return false;
      const message = knownError(error);
      if (message) { state = { ...initial(), errorMessage: message }; publish(); return false; }
      // Unknown outcomes (including unknown 409s) are verified, never replayed.
    }
    return verify(change, token);
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect: () => { connected = true; },
    disconnect: () => { connected = false; generation++; },
    syncSelection,
    changeFlag,
    verify: () => !connected || !state.pending || state.mode !== "idle"
      ? Promise.resolve(false) : verify(state.pending, ++generation),
  };
}

export type PetMascotaFlagsController = ReturnType<typeof createPetMascotaFlagsController>;
export type PetMascotaFlagsSnapshot = ReturnType<PetMascotaFlagsController["getSnapshot"]>;
