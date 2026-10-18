import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { BUSINESS_TYPE } from "../../../shared/types/businessType";
import { usePublicLocalContext } from "../../publicLocal/queries/usePublicLocalContext";
import { PublicLocalContextError } from "../../publicLocal/types/publicLocal.types";
import { consumePetMagicLinkOnce, restorePetSessionOnce, type PetSessionFlowResult } from "../session/publicPetSession.service";
import { parseMagicLinkFragment, removeMagicLinkFragment, type MagicLinkFragment } from "../session/magicLinkFragment";
import { petAccessRedirectPath } from "../session/publicPetRequestUi";
import "../styles/publicPet.css";
import "../../publicLocal/publicLocal.css";

type PageState = PetSessionFlowResult | { status: "loading" };

export function PetAccessPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const context = usePublicLocalContext(slug);
  const claimRef = useRef<{ slug: string; value: MagicLinkFragment } | null>(null);
  const flowRef = useRef<{ slug: string; promise: Promise<PetSessionFlowResult> } | null>(null);
  const [state, setState] = useState<PageState>({ status: "loading" });

  useLayoutEffect(() => {
    if (!slug) return;
    const current = claimRef.current;
    if (!current || current.slug !== slug) {
      const fragment = window.location.hash;
      removeMagicLinkFragment();
      claimRef.current = { slug, value: parseMagicLinkFragment(fragment) };
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const stored = claimRef.current;
    const claim: MagicLinkFragment = stored && stored.slug === slug ? stored.value : { kind: "none" };
    if (context.isLoading) return;
    if (context.error || !context.data) {
      claimRef.current = { slug, value: { kind: "none" } };
      return;
    }
    if (context.data.businessType !== BUSINESS_TYPE.PET_GROOMING) return;
    let flow: Promise<PetSessionFlowResult>;
    if (flowRef.current?.slug === slug) {
      // StrictMode's effect replay subscribes to the exact same consume flow.
      flow = flowRef.current.promise;
    } else {
      flow = claim.kind === "token"
        ? consumePetMagicLinkOnce(slug, claim.token)
        : claim.kind === "invalid"
          ? Promise.resolve<PetSessionFlowResult>({ status: "invalid-link" })
          : restorePetSessionOnce(slug);
      flowRef.current = { slug, promise: flow };
      if (claim.kind === "token" || claim.kind === "invalid") {
        // Drop the challenge from ref state before awaiting the operation.
        claimRef.current = { slug, value: { kind: "none" } };
      }
    }
    let mounted = true;
    void flow.then(result => {
      if (!mounted) return;
      // The secret fragment is already gone; the booking lives only in the landing.
      const destination = petAccessRedirectPath(result.status, slug);
      if (destination) navigate(destination, { replace: true });
      else setState(result);
    });
    return () => { mounted = false; };
  }, [slug, context.data, context.error, context.isLoading, navigate]);

  useEffect(() => {
    if (context.data?.businessType === BUSINESS_TYPE.PET_GROOMING) {
      document.title = `${context.data.nombre} | Acceso | AgendaOK`;
    }
  }, [context.data]);

  if (!slug) return <LocalMessage title="Este local no está disponible." />;
  if (context.isLoading) return <AccessLoading />;
  if (context.error || !context.data) {
    const notFound = context.error instanceof PublicLocalContextError && context.error.status === 404;
    return <LocalMessage title={notFound ? "Este local no está disponible." : "No pudimos cargar este local."} />;
  }
  if (context.data.businessType === BUSINESS_TYPE.BEAUTY) {
    return <Navigate to={`/${encodeURIComponent(slug)}`} replace />;
  }
  if (context.data.businessType !== BUSINESS_TYPE.PET_GROOMING) return <LocalMessage title="Este local no está disponible." />;

  return (
    <main className="pet-public-page">
      <header className="pet-public-hero">
        <p className="pet-public-eyebrow">Peluquería canina</p>
        <h1>{context.data.nombre}</h1>
        <p className="pet-public-subtitle">Acceso a tu cuenta</p>
      </header>
      <div className="pet-public-content">
        {state.status === "loading" && <p role="status" aria-busy="true">Validando acceso…</p>}
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
