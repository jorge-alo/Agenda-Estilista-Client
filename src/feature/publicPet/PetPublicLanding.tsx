import { useEffect } from "react";
import { PetFirstVisitForm } from "./components/PetFirstVisitForm";
import { PetSessionPanel } from "./components/PetSessionPanel";
import { usePetSession } from "./hooks/usePetSession";
import "./styles/publicPet.css";

interface Props {
  nombreLocal: string;
  slug: string;
}

export function PetPublicLanding({ nombreLocal, slug }: Props) {
  const session = usePetSession(slug);
  useEffect(() => {
    document.title = `${nombreLocal} | AgendaOK`;
  }, [nombreLocal]);

  if (session.state.status === "loading" || session.state.status === "logging-out") {
    return <main className="pet-public-page" aria-busy="true"><p className="pet-session-loading" role="status">Validando sesión…</p></main>;
  }

  if (session.state.status === "authenticated") {
    return (
      <main className="pet-public-page">
        <header className="pet-public-hero">
          <p className="pet-public-eyebrow">Peluquería canina</p>
          <h1>{nombreLocal}</h1>
          <p className="pet-public-subtitle">Tu espacio y tus mascotas</p>
        </header>
        <div className="pet-public-content">
          <PetSessionPanel profile={session.state.profile} onLogout={() => void session.logout()} />
        </div>
      </main>
    );
  }

  if (session.state.status === "error") {
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
        <p className="pet-public-subtitle">Solicitar primera visita</p>
      </header>

      <div className="pet-public-content">
        <section className="pet-public-intro">
          <h2>Conocé nuestro espacio</h2>
          <p>La primera visita se coordina con el local. Completá tus datos y los de tu mascota, y se pondrán en contacto con vos.</p>
        </section>

        <PetFirstVisitForm slug={slug} />

        <p className="pet-existing-client-note">
          Si ya sos cliente del local, comunicate por el canal habitual para coordinar tu turno.
        </p>
      </div>
    </main>
  );
}
