import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  logoutPetSession, refreshPetSessionProfileOnce, restorePetSessionOnce,
  type PetProfileRefreshResult,
} from "../session/publicPetSession.service";
import { removePetSession } from "../session/petSessionStorage";
import { invalidateCurrentPetSession, releasePetSessionScope, type PetSessionScopeRef } from "../session/petSessionScope";
import { petSessionUiStateAfterRefresh, type PetSessionUiState } from "../session/petSessionUiState";
import { removePetBookingQueries } from "../booking/publicPetBookingQueries";

export type { PetSessionUiState };

export function usePetSession(slug: string): {
  state: PetSessionUiState;
  retry: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<PetProfileRefreshResult>;
  handleSessionInvalid: (scope: PetSessionScopeRef) => void;
} {
  const client = useQueryClient();
  const [state, setState] = useState<PetSessionUiState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setState({ status: "loading" });
    void restorePetSessionOnce(slug).then(result => {
      if (mounted) setState(result);
    });
    return () => { mounted = false; };
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);

  const logout = useCallback(async () => {
    const current = state;
    if (current.status !== "authenticated") {
      removePetSession(slug);
      setState({ status: "unauthenticated" });
      return;
    }
    const scope = { slug, sessionScope: current.sessionScope };
    setState({ status: "logging-out" });
    try { await logoutPetSession(slug, current.session.token); }
    catch { /* PET-11: the local session is removed in the service's finally block. */ }
    finally {
      await removePetBookingQueries(client, scope);
      releasePetSessionScope(slug, current.sessionScope);
      setState({ status: "unauthenticated" });
    }
  }, [client, slug, state]);

  const refreshProfile = useCallback(async (): Promise<PetProfileRefreshResult> => {
    const current = state;
    if (current.status !== "authenticated") return { status: "stale" };
    const result = await refreshPetSessionProfileOnce(slug, current.sessionScope);
    setState(previous => petSessionUiStateAfterRefresh(previous, result));
    return result;
  }, [slug, state]);

  const handleSessionInvalid = useCallback((scope: PetSessionScopeRef) => {
    if (scope.slug !== slug) return;
    if (!invalidateCurrentPetSession(scope.slug, scope.sessionScope)) return;
    setState(previous => previous.status === "authenticated" || previous.status === "loading"
      ? { status: "expired" }
      : previous);
  }, [slug]);

  return { state, retry, logout, refreshProfile, handleSessionInvalid };
}
