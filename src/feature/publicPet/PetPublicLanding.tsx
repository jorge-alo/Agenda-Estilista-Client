import { useEffect } from "react";
import { PetFirstVisitForm } from "./components/PetFirstVisitForm";
import "./styles/publicPet.css";

interface Props {
  nombreLocal: string;
  slug: string;
}

export function PetPublicLanding({ nombreLocal, slug }: Props) {
  useEffect(() => {
    document.title = `${nombreLocal} | AgendaOK`;
  }, [nombreLocal]);

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
