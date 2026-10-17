import { useEffect } from "react";
import { useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { BUSINESS_TYPE } from "../../shared/types/businessType";
import { ReservaPage } from "../reserva/page/ReservaPage";
import { PetPublicLanding } from "../publicPet/PetPublicLanding";
import { usePublicLocalContext } from "./queries/usePublicLocalContext";
import { PublicLocalContextError } from "./types/publicLocal.types";
import "./publicLocal.css";

export function PublicLocalPage() {
  const { slug } = useParams();
  const { data, error, isLoading, refetch } = usePublicLocalContext(slug ?? "");

  useEffect(() => {
    if (data?.nombre) document.title = `${data.nombre} | AgendaOK`;
  }, [data?.nombre]);

  if (!slug) {
    return <PublicContextMessage title="Este local no está disponible." />;
  }

  if (isLoading) {
    return (
      <main className="public-context-state" aria-busy="true">
        <p role="status">Cargando información del local…</p>
      </main>
    );
  }

  if (error || !data) {
    const notFound = error instanceof PublicLocalContextError && error.status === 404;
    return (
      <PublicContextMessage
        title={notFound ? "Este local no está disponible." : "No pudimos cargar este local."}
        action={!notFound ? <button type="button" onClick={() => void refetch()}>Intentar nuevamente</button> : undefined}
      />
    );
  }

  if (data.businessType === BUSINESS_TYPE.BEAUTY) return <ReservaPage />;
  if (data.businessType === BUSINESS_TYPE.PET_GROOMING) return <PetPublicLanding nombreLocal={data.nombre} slug={slug} />;

  return <PublicContextMessage title="Este local no está disponible." />;
}

function PublicContextMessage({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <main className="public-context-state">
      <section className="public-context-card" role="alert">
        <h1>{title}</h1>
        {action}
      </section>
    </main>
  );
}
