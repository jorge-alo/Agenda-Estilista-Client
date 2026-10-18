import type { PetBookingExtra, PetBookingService } from "../types/publicPetBooking.types";
import {
  PET_BOOKING_EMPTY_SERVICES,
  PET_BOOKING_OPTIONS_ERROR,
  PET_BOOKING_OPTIONS_LOADING,
  PET_BOOKING_PRICE_NOTE,
  petBookingExtraLabel,
  type PetBookingOptionsView,
} from "../booking/publicPetBookingView";

interface Mascota {
  id: number;
  nombre: string;
}

interface Props {
  mascotas: readonly Mascota[];
  mascotaId: number | null;
  servicios: readonly PetBookingService[];
  servicioId: number | null;
  extras: readonly PetBookingExtra[];
  extraIds: readonly number[];
  fecha: string;
  minFecha: string;
  optionsStatus: PetBookingOptionsView;
  locked: boolean;
  duracionLabel: string | null;
  onMascota: (mascotaId: number) => void;
  onServicio: (servicioId: number) => void;
  onToggleExtra: (extraId: number) => void;
  onFecha: (fecha: string) => void;
  onRetryOptions: () => void;
}

export function PetBookingSelection({
  mascotas, mascotaId, servicios, servicioId, extras, extraIds, fecha, minFecha,
  optionsStatus, locked, duracionLabel, onMascota, onServicio, onToggleExtra, onFecha, onRetryOptions,
}: Props) {
  const serviciosDisponibles = optionsStatus === "ready" && servicios.length > 0;

  return (
    <>
      <fieldset className="pet-booking-group" disabled={locked}>
        <legend>Mascota</legend>
        <div className="pet-booking-options">
          {mascotas.map(mascota => (
            <label key={mascota.id} className="pet-booking-option" data-selected={mascotaId === mascota.id}>
              <input type="radio" name="pet-booking-mascota" value={mascota.id}
                checked={mascotaId === mascota.id} onChange={() => onMascota(mascota.id)} />
              <span className="pet-booking-option-name">{mascota.nombre}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {optionsStatus === "loading" && (
        <p className="pet-booking-status" role="status">{PET_BOOKING_OPTIONS_LOADING}</p>
      )}

      {optionsStatus === "error" && (
        <div className="pet-booking-error" role="alert">
          <p>{PET_BOOKING_OPTIONS_ERROR}</p>
          <button type="button" className="pet-booking-retry" onClick={onRetryOptions}>Volver a intentar</button>
        </div>
      )}

      {optionsStatus === "ready" && servicios.length === 0 && (
        <p className="pet-booking-status" role="status">{PET_BOOKING_EMPTY_SERVICES}</p>
      )}

      {serviciosDisponibles && (
        <>
          <fieldset className="pet-booking-group" disabled={locked}>
            <legend>Servicio</legend>
            <div className="pet-booking-options">
              {servicios.map(servicio => (
                <label key={servicio.id} className="pet-booking-option" data-selected={servicioId === servicio.id}>
                  <input type="radio" name="pet-booking-servicio" value={servicio.id}
                    checked={servicioId === servicio.id} onChange={() => onServicio(servicio.id)} />
                  <span className="pet-booking-option-text">
                    <span className="pet-booking-option-name">{servicio.nombre}</span>
                    <span className="pet-booking-option-meta">{servicio.duracionMinutos} min</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {extras.length > 0 && (
            <fieldset className="pet-booking-group" disabled={locked}>
              <legend>Extras</legend>
              <div className="pet-booking-options">
                {extras.map(extra => (
                  <label key={extra.id} className="pet-booking-option" data-selected={extraIds.includes(extra.id)}>
                    <input type="checkbox" value={extra.id}
                      checked={extraIds.includes(extra.id)} onChange={() => onToggleExtra(extra.id)} />
                    <span className="pet-booking-option-name">{petBookingExtraLabel(extra)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="pet-booking-date">
            <label htmlFor="pet-booking-fecha">Fecha</label>
            <input id="pet-booking-fecha" type="date" min={minFecha} value={fecha}
              disabled={locked} onChange={event => onFecha(event.target.value)} />
          </div>
        </>
      )}

      {servicioId !== null && duracionLabel && (
        <p className="pet-booking-duration">Duración: {duracionLabel}</p>
      )}

      {servicioId !== null && (
        <p className="pet-booking-price">{PET_BOOKING_PRICE_NOTE}</p>
      )}
    </>
  );
}
