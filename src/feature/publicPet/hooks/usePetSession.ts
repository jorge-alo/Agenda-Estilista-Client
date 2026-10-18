import { useCallback, useEffect, useState } from "react";
import { logoutPetSession, restorePetSessionOnce, type PetSessionFlowResult } from "../session/publicPetSession.service";
import { removePetSession } from "../session/petSessionStorage";

export type PetSessionUiState = PetSessionFlowResult | { status: "loading" | "logging-out" };

export function usePetSession(slug: string): {
  state: PetSessionUiState;
  retry: () => void;
  logout: () => Promise<void>;
} {
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
    setState({ status: "logging-out" });
    try { await logoutPetSession(slug, current.session.token); }
    catch { /* The local session is removed in the service's finally block. */ }
    finally { setState({ status: "unauthenticated" }); }
  }, [slug, state]);

  return { state, retry, logout };
}
