import { useEffect, useId, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) itemRef.current?.focus();
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    onLogout();
  }

  return (
    <section className="pet-session-card" aria-label="Tu sesión de mascotas">
      <div className="pet-session-heading">
        <h2>Hola, {profile.cliente.nombre}</h2>
        <div
          ref={menuRef}
          className="pet-session-menu-wrap"
          onBlur={event => {
            if (event.relatedTarget instanceof Node && menuRef.current?.contains(event.relatedTarget)) return;
            setMenuOpen(false);
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            className="pet-session-menu-trigger"
            aria-label="Opciones de sesión"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen(open => !open)}
            onKeyDown={event => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              if (menuOpen) itemRef.current?.focus();
              else setMenuOpen(true);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <div className="pet-session-menu" id={menuId} role="menu" aria-label="Opciones de sesión">
              <button
                ref={itemRef}
                type="button"
                role="menuitem"
                className="pet-session-menu-item"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </div>
          )}
        </div>
      </div>
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
    </section>
  );
}
