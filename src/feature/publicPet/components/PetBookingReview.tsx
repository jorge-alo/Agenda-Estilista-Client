import { formatearFechaBookingArgentina } from "../booking/publicPetBookingState";
import { PET_BOOKING_PRICE_NOTE, PET_BOOKING_SUBMITTING, petBookingSlotLabel } from "../booking/publicPetBookingView";

interface Props {
  mascotaNombre: string;
  servicioNombre: string;
  extras: readonly { id: number; nombre: string }[];
  fecha: string;
  slot: { horaInicio: string; horaFin: string };
  duracionLabel: string | null;
  canConfirm: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
}

export function PetBookingReview({
  mascotaNombre, servicioNombre, extras, fecha, slot, duracionLabel, canConfirm, isSubmitting, onConfirm,
}: Props) {
  return (
    <section className="pet-booking-section pet-booking-review" aria-labelledby="pet-booking-review-title">
      <h3 id="pet-booking-review-title">Resumen</h3>
      <dl className="pet-booking-summary">
        <div><dt>Mascota</dt><dd>{mascotaNombre}</dd></div>
        <div><dt>Servicio</dt><dd>{servicioNombre}</dd></div>
        <div><dt>Extras</dt><dd>{extras.length === 0 ? "Sin extras" : extras.map(extra => extra.nombre).join(", ")}</dd></div>
        <div><dt>Fecha</dt><dd>{formatearFechaBookingArgentina(fecha)}</dd></div>
        <div><dt>Horario</dt><dd>{petBookingSlotLabel(slot)}</dd></div>
        {duracionLabel && <div><dt>Duración</dt><dd>{duracionLabel}</dd></div>}
      </dl>
      <p className="pet-booking-price">{PET_BOOKING_PRICE_NOTE}</p>
      <button type="button" className="pet-booking-confirm" disabled={!canConfirm || isSubmitting} onClick={onConfirm}>
        Confirmar turno
      </button>
      {isSubmitting && <p className="pet-booking-status" role="status">{PET_BOOKING_SUBMITTING}</p>}
    </section>
  );
}
