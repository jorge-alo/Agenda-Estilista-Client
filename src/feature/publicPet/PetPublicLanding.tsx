import { useEffect, useState } from "react";
import { PetFirstVisitForm } from "./components/PetFirstVisitForm";
import { PetBookingFlow } from "./components/PetBookingFlow";
import { PetExistingClientAccess } from "./components/PetExistingClientAccess";
import { usePetSession } from "./hooks/usePetSession";
import { getPetLandingMode, PET_SESSION_EXPIRED_MESSAGE } from "./session/publicPetRequestUi";
import "./styles/publicPet.css";

interface Props {
  nombreLocal: string;
  slug: string;
}

export type PetEntryView = "selector" | "primera-visita" | "cliente-existente";

interface EntryProps {
  slug: string;
  view: PetEntryView;
  requestPending: boolean;
  onChoose: (view: PetEntryView) => void;
  onBack: () => void;
  onSubmittingChange: (pending: boolean) => void;
}

export function PetPublicEntry({ slug, view, requestPending, onChoose, onBack, onSubmittingChange }: EntryProps) {
  if (view === "selector") {
    return (
      <section className="pet-entry-selector" aria-labelledby="pet-entry-title">
        <h2 id="pet-entry-title">¿Cómo querés continuar?</h2>
        <button className="pet-entry-option" type="button" onClick={() => onChoose("primera-visita")}>
          <span className="pet-entry-option-title">Primera vez en el local</span>
          <span className="pet-entry-option-description">Completá tus datos para solicitar tu primera visita.</span>
        </button>
        <button className="pet-entry-option" type="button" onClick={() => onChoose("cliente-existente")}>
          <span className="pet-entry-option-title">Ya soy cliente</span>
          <span className="pet-entry-option-description">Ingresá con tu celular para acceder a tus mascotas y reservar.</span>
        </button>
      </section>
    );
  }

  return (
    <>
      <button className="pet-entry-back" type="button" disabled={requestPending} onClick={() => { if (!requestPending) onBack(); }}>Volver</button>
      {view === "primera-visita" ? (
        <>
          <section className="pet-public-intro">
            <h2>Conocé nuestro espacio</h2>
            <p>La primera visita se coordina con el local. Completá tus datos y los de tu mascota, y se pondrán en contacto con vos.</p>
          </section>
          <PetFirstVisitForm slug={slug} onSubmittingChange={onSubmittingChange} />
        </>
      ) : (
        <PetExistingClientAccess slug={slug} direct onSubmittingChange={onSubmittingChange} />
      )}
    </>
  );
}

export function PetPublicLanding({ nombreLocal, slug }: Props) {
  const session = usePetSession(slug);
  const landingMode = getPetLandingMode(session.state.status);
  const [entryView, setEntryView] = useState<PetEntryView>("selector");
  const [requestPending, setRequestPending] = useState(false);
  const backToSelector = () => {
    if (requestPending) return;
    setEntryView("selector");
  };
  useEffect(() => {
    document.title = `${nombreLocal} | AgendaOK`;
  }, [nombreLocal]);

  if (landingMode === "loading") {
    return <main className="pet-public-page" aria-busy="true"><p className="pet-session-loading" role="status">Validando sesión…</p></main>;
  }

  if (landingMode === "authenticated" && session.state.status === "authenticated") {
    return (
      <main className="pet-public-page">
        <header className="pet-public-hero">
          <p className="pet-public-eyebrow">Peluquería canina</p>
          <h1>{nombreLocal}</h1>
          <p className="pet-public-subtitle">Reservá y gestioná los turnos de tus mascotas</p>
        </header>
        <div className="pet-public-content">
          <PetBookingFlow
            slug={slug}
            token={session.state.session.token}
            sessionScope={session.state.sessionScope}
            profile={session.state.profile}
            status={session.state.status}
            onLogout={() => void session.logout()}
            onSessionInvalid={session.handleSessionInvalid}
            onRefreshProfile={session.refreshProfile}
          />
        </div>
      </main>
    );
  }

  if (landingMode === "error") {
    return (
      <main className="pet-public-page">
        <header className="pet-public-hero"><p className="pet-public-eyebrow">Peluquería canina</p><h1>{nombreLocal}</h1></header>
        <section className="pet-session-card pet-session-error" role="alert">
          <p>No pudimos validar tu sesión.</p>
          <button className="pet-session-logout" type="button" onClick={session.retry}>Intentar nuevamente</button>
        </section>
      </main>
    );
  }

  return (
    <main className="pet-public-page">
      <header className="pet-public-hero">
        <p className="pet-public-eyebrow">Peluquería canina</p>
        <h1>{nombreLocal}</h1>
        <p className="pet-public-subtitle">Reservar turno</p>
      </header>

      <div className="pet-public-content">
        {session.state.status === "expired" && (
          <section className="pet-session-message" role="status">
            <p>{PET_SESSION_EXPIRED_MESSAGE}</p>
          </section>
        )}

        <PetPublicEntry
          slug={slug}
          view={entryView}
          requestPending={requestPending}
          onChoose={setEntryView}
          onBack={backToSelector}
          onSubmittingChange={setRequestPending}
        />
      </div>
    </main>
  );
}
