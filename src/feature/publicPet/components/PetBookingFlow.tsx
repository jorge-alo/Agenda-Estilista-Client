import { PetSessionPanel } from "./PetSessionPanel";
import { usePetBooking } from "../hooks/usePetBooking";
import { canStartPetLogout } from "../session/publicPetRequestUi";
import type { PetPublicProfile } from "../session/publicPetSession.service";
import type { PetSessionScopeRef } from "../session/petSessionScope";

interface Props {
  slug: string;
  token: string;
  sessionScope: string;
  profile: PetPublicProfile;
  status: "authenticated" | "logging-out";
  onLogout: () => void;
  onSessionInvalid: (scope: PetSessionScopeRef) => void;
}

/** Minimal booking integration shell; selectors/cards/review arrive in later PET-12F phases. */
export function PetBookingFlow({ slug, token, sessionScope, profile, status, onLogout, onSessionInvalid }: Props) {
  const booking = usePetBooking({ slug, token, sessionScope, profile, onSessionInvalid });
  const isSubmitting = booking.creation.isPending;

  return (
    <>
      <PetSessionPanel
        profile={profile}
        showMascotas={false}
        loggingOut={status === "logging-out"}
        onLogout={() => { if (canStartPetLogout(isSubmitting, status)) onLogout(); }}
      />
      <section className="pet-session-card" aria-label="Reservar turno">
        <h2>Reservá un turno</h2>
        <p className="pet-session-muted">
          {isSubmitting ? "Creando tu reserva…" : "Muy pronto vas a poder elegir servicio, fecha y horario."}
        </p>
      </section>
    </>
  );
}
