import { formatearFechaBookingArgentina, type PetBookingSuccess as PetBookingSuccessSnapshot } from "../booking/publicPetBookingState";
import { petBookingSlotLabel } from "../booking/publicPetBookingView";

interface Props {
  success: PetBookingSuccessSnapshot;
  onNewBooking: () => void;
}

export function PetBookingSuccess({ success, onNewBooking }: Props) {
  return (
    <section className="pet-booking-card pet-booking-success" aria-labelledby="pet-booking-success-title">
      <h2 id="pet-booking-success-title">Turno confirmado</h2>
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
