import type { PetPublicProfile } from "../session/publicPetSession.service";
import { formatearFechaBookingArgentina } from "../booking/publicPetBookingState";

interface Props {
  profile: PetPublicProfile;
  onLogout: () => void;
  loggingOut?: boolean;
  /** Inside the booking flow the pet selector owns the pet list. */
  showMascotas?: boolean;
  turnosRefreshStatus?: "loading" | "error" | null;
}

export function PetSessionPanel({ profile, onLogout, loggingOut = false, showMascotas = true, turnosRefreshStatus = null }: Props) {
  return (
    <section className="pet-session-card" aria-label="Tu sesión de mascotas">
      <h2>Hola, {profile.cliente.nombre}</h2>
      <section className="pet-booking-section" aria-label="Tus próximos turnos">
        <h3>Tus próximos turnos</h3>
        {turnosRefreshStatus === "loading" ? <p className="pet-session-muted" role="status">Actualizando tus turnos…</p>
          : turnosRefreshStatus === "error" ? <p className="pet-session-muted" role="alert">No pudimos actualizar tus próximos turnos. Volvé a cargar la página para intentar nuevamente.</p>
            : profile.proximosTurnos.length === 0 ? <p className="pet-session-muted">No tenés próximos turnos reservados</p>
              : <ul className="pet-session-turnos">
                {profile.proximosTurnos.map(turno => (
                  <li className="pet-session-turno" key={turno.id}>
                    <strong>{turno.mascota.nombre}</strong>
                    <dl className="pet-booking-summary">
                      <div><dt>Fecha</dt><dd>{formatearFechaBookingArgentina(turno.fecha)}</dd></div>
                      <div><dt>Hora</dt><dd>{turno.hora}</dd></div>
                      <div><dt>Servicio</dt><dd>{turno.servicio}</dd></div>
                      <div><dt>Estado</dt><dd>Confirmado</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>}
      </section>
      {showMascotas && (profile.mascotas.length > 0 ? (
        <ul className="pet-session-list">
          {profile.mascotas.map(mascota => <li key={mascota.id}>{mascota.nombre}</li>)}
        </ul>
      ) : (
        <p className="pet-session-muted">No hay mascotas habilitadas para reserva online en este momento.</p>
      ))}
      <button className="pet-session-logout pet-session-logout-link" type="button" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </section>
  );
}
