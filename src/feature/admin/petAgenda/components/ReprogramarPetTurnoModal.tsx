import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { PetApiError } from "../services/petTurnos.service";
import { usePetTurnoDisponibilidad } from "../hooks/usePetTurnoDisponibilidad";
import { useReprogramarPetTurno } from "../hooks/useReprogramarPetTurno";
import { isValidPetDate, type TurnoPet } from "../types/petTurno.types";

interface Props {
  turno: TurnoPet;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReprogramarPetTurnoModal({ turno, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(turno.fecha);
  const [seleccion, setSeleccion] = useState<{ fecha: string; hora: string } | null>(null);
  const validDate = isValidPetDate(fecha);
  const horaSeleccionada = seleccion?.fecha === fecha ? seleccion.hora : null;
  const availability = usePetTurnoDisponibilidad(turno.id, fecha, validDate);
  const reprogramacion = useReprogramarPetTurno();
  const slots = availability.data?.fecha === fecha ? availability.data.slots : [];
  const showLoading = validDate && (availability.isLoading || (availability.isFetching && !availability.data));

  const confirmar = () => {
    if (!validDate || !horaSeleccionada || reprogramacion.isPending) return;
    reprogramacion.mutate({ turnoId: turno.id, fecha, hora: horaSeleccionada }, {
      onSuccess,
      onError: error => {
        if (error instanceof PetApiError && error.status === 409 && error.code === "PET_SLOT_UNAVAILABLE") {
          setSeleccion(null);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.petTurnoDisponibilidad.turnoFecha(turno.id, fecha),
          });
        }
      },
    });
  };

  return (
    <div
      className="pet-reschedule-backdrop"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !reprogramacion.isPending) onClose(); }}
    >
      <section className="pet-reschedule-modal" role="dialog" aria-modal="true" aria-labelledby="pet-reschedule-title">
        <header className="pet-reschedule-modal__header">
          <div>
            <h2 id="pet-reschedule-title">Reprogramar turno PET</h2>
            <p>{turno.mascota.nombre} · actualmente {turno.fecha} {turno.hora}</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={reprogramacion.isPending}>×</button>
        </header>

        <label className="pet-reschedule-modal__date">
          Fecha nueva
          <input
            type="date"
            value={fecha}
            onChange={event => {
              setFecha(event.target.value);
              setSeleccion(null);
            }}
          />
        </label>

        {!validDate ? (
          <p className="pet-reschedule-modal__message" role="alert">Selecciona una fecha válida.</p>
        ) : showLoading ? (
          <p className="pet-reschedule-modal__message" role="status">Buscando horarios disponibles…</p>
        ) : availability.isError ? (
          <div className="pet-reschedule-modal__message" role="alert">
            <p>{availability.error.message || "No se pudo consultar la disponibilidad."}</p>
            <button type="button" onClick={() => void availability.refetch()}>Reintentar</button>
          </div>
        ) : slots.length === 0 ? (
          <p className="pet-reschedule-modal__message">No hay horarios disponibles para esta fecha.</p>
        ) : (
          <div className="pet-reschedule-modal__slots" role="group" aria-label="Horarios disponibles">
            {availability.data && <p>Duración del turno: {availability.data.duracionMinutos} min</p>}
            <div className="pet-reschedule-modal__slot-grid">
              {slots.map(slot => (
                <button
                  type="button"
                  key={`${slot.horaInicio}-${slot.horaFin}`}
                  aria-pressed={horaSeleccionada === slot.horaInicio}
                  disabled={reprogramacion.isPending}
                  onClick={() => setSeleccion({ fecha, hora: slot.horaInicio })}
                >
                  {slot.horaInicio} - {slot.horaFin}
                </button>
              ))}
            </div>
          </div>
        )}

        {reprogramacion.isError && !(reprogramacion.error instanceof PetApiError
          && reprogramacion.error.code === "PET_SLOT_UNAVAILABLE") && (
          <p className="pet-reschedule-modal__message" role="alert">{reprogramacion.error.message}</p>
        )}

        <footer className="pet-reschedule-modal__footer">
          <button type="button" className="pet-reschedule-modal__secondary" onClick={onClose} disabled={reprogramacion.isPending}>
            Cerrar
          </button>
          <button type="button" onClick={confirmar} disabled={!horaSeleccionada || !validDate || reprogramacion.isPending}>
            {reprogramacion.isPending ? "Reprogramando…" : "Confirmar horario"}
          </button>
        </footer>
      </section>
    </div>
  );
}
