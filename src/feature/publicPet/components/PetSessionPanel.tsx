import type { PetPublicProfile } from "../session/publicPetSession.service";

interface Props {
  profile: PetPublicProfile;
  onLogout: () => void;
  loggingOut?: boolean;
}

export function PetSessionPanel({ profile, onLogout, loggingOut = false }: Props) {
  return (
    <section className="pet-session-card" aria-label="Tu sesión de mascotas">
      <h2>Hola, {profile.cliente.nombre}</h2>
      {profile.mascotas.length > 0 ? (
        <ul className="pet-session-list">
          {profile.mascotas.map(mascota => <li key={mascota.id}>{mascota.nombre}</li>)}
        </ul>
      ) : (
        <p className="pet-session-muted">No hay mascotas habilitadas para reserva online en este momento.</p>
      )}
      <button className="pet-session-logout" type="button" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </section>
  );
}
