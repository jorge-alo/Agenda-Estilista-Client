import { useEffect } from "react";
import { PetFirstVisitForm } from "./components/PetFirstVisitForm";
import { PetSessionPanel } from "./components/PetSessionPanel";
import { PetExistingClientAccess } from "./components/PetExistingClientAccess";
import { usePetSession } from "./hooks/usePetSession";
import { getPetLandingMode } from "./session/publicPetRequestUi";
import "./styles/publicPet.css";

interface Props {
  nombreLocal: string;
  slug: string;
}

export function PetPublicLanding({ nombreLocal, slug }: Props) {
  const session = usePetSession(slug);
  const landingMode = getPetLandingMode(session.state.status);
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
          <p className="pet-public-subtitle">Tu espacio y tus mascotas</p>
        </header>
        <div className="pet-public-content">
          <PetSessionPanel profile={session.state.profile} onLogout={() => void session.logout()} />
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
        <p className="pet-public-subtitle">Solicitar primera visita</p>
      </header>

      <div className="pet-public-content">
        <section className="pet-public-intro">
          <h2>Conocé nuestro espacio</h2>
          <p>La primera visita se coordina con el local. Completá tus datos y los de tu mascota, y se pondrán en contacto con vos.</p>
        </section>

        <PetFirstVisitForm slug={slug} />

        <PetExistingClientAccess slug={slug} />
      </div>
    </main>
  );
}
