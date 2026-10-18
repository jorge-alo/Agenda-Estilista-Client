import type { PetAvailabilitySlot } from "../types/publicPetBooking.types";
import {
  PET_BOOKING_EMPTY_SLOTS,
  PET_BOOKING_OPTIONS_ERROR,
  PET_BOOKING_SLOTS_LOADING,
  petBookingSlotLabel,
  type PetBookingSlotsView,
} from "../booking/publicPetBookingView";

interface SelectedSlot {
  horaInicio: string;
  horaFin: string;
}

interface Props {
  view: PetBookingSlotsView;
  slots: readonly PetAvailabilitySlot[];
  selectionKey: string;
  selected: SelectedSlot | null;
  locked: boolean;
  onSelect: (slot: PetAvailabilitySlot, selectionKey: string) => void;
  onRetry: () => void;
}

export function PetBookingSlots({ view, slots, selectionKey, selected, locked, onSelect, onRetry }: Props) {
  return (
    <section className="pet-booking-section" aria-labelledby="pet-booking-slots-title">
      <h3 id="pet-booking-slots-title">Horarios</h3>

      {view === "loading" && (
        <p className="pet-booking-status" role="status">{PET_BOOKING_SLOTS_LOADING}</p>
      )}

      {view === "error" && (
        <div className="pet-booking-error" role="alert">
          <p>{PET_BOOKING_OPTIONS_ERROR}</p>
          <button type="button" className="pet-booking-retry" onClick={onRetry}>Volver a intentar</button>
        </div>
      )}

      {view === "empty" && (
        <p className="pet-booking-status" role="status">{PET_BOOKING_EMPTY_SLOTS}</p>
      )}

      {view === "ready" && (
        <fieldset className="pet-booking-group" disabled={locked}>
          <legend className="pet-booking-visually-hidden">Horarios disponibles</legend>
          <div className="pet-booking-slots">
            {slots.map(slot => {
              const checked = selected?.horaInicio === slot.horaInicio && selected?.horaFin === slot.horaFin;
              return (
                <label key={`${slot.horaInicio}-${slot.horaFin}`} className="pet-booking-slot" data-selected={checked}>
                  <input type="radio" name="pet-booking-slot" value={slot.horaInicio}
                    checked={checked} onChange={() => onSelect(slot, selectionKey)} />
                  <span>{petBookingSlotLabel(slot)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}
