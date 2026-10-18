import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BUSINESS_TYPE } from "../../../shared/types/businessType";
import { usePublicLocalContext } from "../../publicLocal/queries/usePublicLocalContext";
import { PublicLocalContextError } from "../../publicLocal/types/publicLocal.types";
import { PetSessionPanel } from "../components/PetSessionPanel";
import { consumePetMagicLinkOnce, restorePetSessionOnce, type PetSessionFlowResult } from "../session/publicPetSession.service";
import { parseMagicLinkFragment, removeMagicLinkFragment, type MagicLinkFragment } from "../session/magicLinkFragment";
import { logoutPetSession } from "../session/publicPetSession.service";
import { removePetSession } from "../session/petSessionStorage";
import "../styles/publicPet.css";
import "../../publicLocal/publicLocal.css";

type PageState = PetSessionFlowResult | { status: "loading" };

export function PetAccessPage() {
  const { slug = "" } = useParams();
  const context = usePublicLocalContext(slug);
  const [claim, setClaim] = useState<MagicLinkFragment | null>(null);
  const claimRef = useRef<{ slug: string; value: MagicLinkFragment } | null>(null);
  const flowRef = useRef<{ slug: string; promise: Promise<PetSessionFlowResult> } | null>(null);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useLayoutEffect(() => {
    if (!slug) return;
    let current = claimRef.current;
    if (!current || current.slug !== slug) {
      const fragment = window.location.hash;
      removeMagicLinkFragment();
      current = { slug, value: parseMagicLinkFragment(fragment) };
      claimRef.current = current;
    }
    setClaim(current.value);
  }, [slug]);

  useEffect(() => {
    if (!slug || !claim) return;
    if (context.isLoading) return;
    if (context.error || !context.data) {
      const notFound = context.error instanceof PublicLocalContextError && context.error.status === 404;
      setState({ status: notFound ? "local-unavailable" : "error" });
      claimRef.current = { slug, value: { kind: "none" } };
      if (claim.kind !== "none") setClaim({ kind: "none" });
      return;
    }
    if (context.data.businessType !== BUSINESS_TYPE.PET_GROOMING) return;
    let flow: Promise<PetSessionFlowResult>;
    if (flowRef.current?.slug === slug) {
      // StrictMode's effect replay subscribes to the exact same consume flow.
      flow = flowRef.current.promise;
    } else {
      const currentClaim = claim;
      flow = currentClaim.kind === "token"
        ? consumePetMagicLinkOnce(slug, currentClaim.token)
        : currentClaim.kind === "invalid"
          ? Promise.resolve<PetSessionFlowResult>({ status: "invalid-link" })
          : restorePetSessionOnce(slug);
      flowRef.current = { slug, promise: flow };
      if (currentClaim.kind === "token" || currentClaim.kind === "invalid") {
        // Drop the challenge from component/ref state before awaiting the operation.
        claimRef.current = { slug, value: { kind: "none" } };
        setClaim({ kind: "none" });
      }
    }
    let mounted = true;
    void flow.then(result => { if (mounted) setState(result); });
    return () => { mounted = false; };
  }, [slug, claim, context.data, context.error, context.isLoading]);

  useEffect(() => {
    if (context.data?.businessType === BUSINESS_TYPE.PET_GROOMING) {
      document.title = `${context.data.nombre} | Acceso | AgendaOK`;
    }
  }, [context.data]);

  if (!slug) return <LocalMessage title="Este local no está disponible." />;
  if (context.isLoading || !claim) return <AccessLoading />;
  if (context.error || !context.data) {
    const notFound = context.error instanceof PublicLocalContextError && context.error.status === 404;
    return <LocalMessage title={notFound ? "Este local no está disponible." : "No pudimos cargar este local."} />;
  }
  if (context.data.businessType === BUSINESS_TYPE.BEAUTY) {
    return <Navigate to={`/${encodeURIComponent(slug)}`} replace />;
  }
  if (context.data.businessType !== BUSINESS_TYPE.PET_GROOMING) return <LocalMessage title="Este local no está disponible." />;

  const logout = async (token: string) => {
    setIsLoggingOut(true);
    try { await logoutPetSession(slug, token); }
    catch { removePetSession(slug); }
    finally {
      removePetSession(slug);
      setState({ status: "unauthenticated" });
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="pet-public-page">
      <header className="pet-public-hero">
        <p className="pet-public-eyebrow">Peluquería canina</p>
        <h1>{context.data.nombre}</h1>
        <p className="pet-public-subtitle">Acceso a tu cuenta</p>
      </header>
      <div className="pet-public-content">
        {state.status === "loading" && <p role="status" aria-busy="true">Validando acceso…</p>}
        {state.status === "authenticated" && <PetSessionPanel profile={state.profile} onLogout={() => void logout(state.session.token)} loggingOut={isLoggingOut} />}
        {state.status === "invalid-link" && <AccessMessage>
          El enlace no es válido o venció. Solicitá uno nuevo desde la agenda del local.
        </AccessMessage>}
        {state.status === "unauthenticated" && <AccessMessage>
          No hay una sesión activa. Solicitá un nuevo enlace desde la agenda del local.
        </AccessMessage>}
        {state.status === "local-unavailable" && <LocalMessage title="Este local no está disponible." />}
        {state.status === "error" && <AccessMessage> No pudimos validar tu acceso. Intentá nuevamente.</AccessMessage>}
        <p className="pet-session-back"><Link to={`/${encodeURIComponent(slug)}`}>Volver a la agenda del local</Link></p>
      </div>
    </main>
  );
}

function AccessLoading() {
  return <main className="public-context-state" aria-busy="true"><p role="status">Validando acceso…</p></main>;
}

function AccessMessage({ children }: { children: ReactNode }) {
  return <section className="pet-session-message" role="alert">{children}</section>;
}

function LocalMessage({ title }: { title: string }) {
  return <main className="public-context-state"><section className="public-context-card" role="alert"><h1>{title}</h1></section></main>;
}
