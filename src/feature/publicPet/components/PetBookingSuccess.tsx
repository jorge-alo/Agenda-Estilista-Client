import type { Ref } from "react";
import { formatearFechaBookingArgentina, type PetBookingSuccess as PetBookingSuccessSnapshot } from "../booking/publicPetBookingState";
import { petBookingSlotLabel } from "../booking/publicPetBookingView";

interface Props {
  success: PetBookingSuccessSnapshot;
  onNewBooking: () => void;
  containerRef?: Ref<HTMLElement>;
}

export function PetBookingSuccess({ success, onNewBooking, containerRef }: Props) {
  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      className="pet-booking-card pet-booking-success"
      aria-labelledby="pet-booking-success-title"
    >
      <div className="pet-booking-success-heading">
        <span className="pet-booking-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 id="pet-booking-success-title">Turno confirmado</h2>
      </div>
      <dl className="pet-booking-summary">
        <div><dt>Mascota</dt><dd>{success.mascotaNombre}</dd></div>
        <div><dt>Servicio</dt><dd>{success.servicioNombre}</dd></div>
        <div><dt>Fecha</dt><dd>{formatearFechaBookingArgentina(success.fecha)}</dd></div>
        <div><dt>Hora</dt><dd>{petBookingSlotLabel({ horaInicio: success.hora, horaFin: success.horaFin })}</dd></div>
      </dl>
      <button type="button" className="pet-booking-confirm" onClick={onNewBooking}>Reservar otro turno</button>
    </section>
  );
}
