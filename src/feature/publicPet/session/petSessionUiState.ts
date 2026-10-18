import type { PetProfileRefreshResult, PetSessionFlowResult } from "./publicPetSession.service.ts";

export type PetSessionUiState =
  | PetSessionFlowResult
  | { status: "loading" }
  | { status: "logging-out" }
  | { status: "expired" };

/** A profile refresh never unmounts the authenticated view; only a scoped 401 expires it. */
export function petSessionUiStateAfterRefresh(state: PetSessionUiState, result: PetProfileRefreshResult): PetSessionUiState {
  if (state.status !== "authenticated") return state;
  if (result.status === "refreshed") return { ...state, profile: result.profile };
  if (result.status === "unauthorized") return { status: "expired" };
  return state;
}
