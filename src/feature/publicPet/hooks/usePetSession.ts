import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  logoutPetSession, refreshPetSessionProfileOnce, restorePetSessionOnce,
  type PetProfileRefreshResult,
} from "../session/publicPetSession.service";
import { isPersistedPetSession, readPetSession, removeExpectedPetSession } from "../session/petSessionStorage";
import { clearPetSessionScope, invalidateCurrentPetSession, releasePetSessionScope, type PetSessionScopeRef } from "../session/petSessionScope";
import { watchPetSession } from "../session/petSessionLifecycle";
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
  const generation = useRef(0);

  useEffect(() => {
    let mounted = true;
    const currentGeneration = ++generation.current;
    setState({ status: "loading" });
    void restorePetSessionOnce(slug).then(result => {
      if (mounted && currentGeneration === generation.current) setState(result);
    });
    return () => { mounted = false; };
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const authenticated = state.status === "authenticated" ? state : null;
    const reset = (expired = false) => {
      generation.current++;
      clearPetSessionScope(slug);
      if (authenticated) void removePetBookingQueries(client, { slug, sessionScope: authenticated.sessionScope });
      const next = readPetSession(slug);
      setState(next ? { status: "loading" } : { status: expired ? "expired" : "unauthenticated" });
      if (next) setAttempt(value => value + 1);
    };
    return watchPetSession(slug, authenticated?.session ?? null,
      () => reset(),
      () => {
        if (authenticated) removeExpectedPetSession(slug, authenticated.session);
        reset(true);
      },
      () => reset());
  }, [client, slug, state]);

  const logout = useCallback(async () => {
    const current = state;
    if (current.status !== "authenticated") {
      setState({ status: "unauthenticated" });
      return;
    }
    const currentGeneration = ++generation.current;
    const scope = { slug, sessionScope: current.sessionScope };
    releasePetSessionScope(slug, current.sessionScope);
    void removePetBookingQueries(client, scope);
    const request = logoutPetSession(slug, current.session.token);
    setState({ status: "unauthenticated" });
    try { await request; }
    catch { /* PET-11: the local session is removed in the service's finally block. */ }
    finally {
      await removePetBookingQueries(client, scope);
      if (generation.current === currentGeneration) {
        if (readPetSession(slug)) { setState({ status: "loading" }); retry(); }
        else setState({ status: "unauthenticated" });
      }
    }
  }, [client, slug, state, retry]);

  const refreshProfile = useCallback(async (): Promise<PetProfileRefreshResult> => {
    const current = state;
    if (current.status !== "authenticated") return { status: "stale" };
    const currentGeneration = generation.current;
    const result = await refreshPetSessionProfileOnce(slug, current.sessionScope);
    if (currentGeneration === generation.current) {
      if (result.status === "unauthorized" || result.status === "stale") {
        void removePetBookingQueries(client, { slug, sessionScope: current.sessionScope });
        if (!isPersistedPetSession(slug, current.session)) {
          generation.current++;
          clearPetSessionScope(slug);
          if (readPetSession(slug)) { setState({ status: "loading" }); retry(); }
          else setState({ status: "expired" });
          return result;
        }
      }
      setState(previous => petSessionUiStateAfterRefresh(previous, result));
    }
    return result;
  }, [client, retry, slug, state]);

  const handleSessionInvalid = useCallback((scope: PetSessionScopeRef) => {
    if (scope.slug !== slug) return;
    if (state.status === "authenticated" && !isPersistedPetSession(slug, state.session)) {
      generation.current++;
      clearPetSessionScope(slug);
      void removePetBookingQueries(client, scope);
      setState({ status: "loading" });
      retry();
      return;
    }
    if (!invalidateCurrentPetSession(scope.slug, scope.sessionScope)) return;
    generation.current++;
    void removePetBookingQueries(client, scope);
    setState(previous => previous.status === "authenticated" || previous.status === "loading"
      ? { status: "expired" }
      : previous);
  }, [client, retry, slug, state]);

  return { state, retry, logout, refreshProfile, handleSessionInvalid };
}
