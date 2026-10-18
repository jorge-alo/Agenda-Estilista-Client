import { useEffect } from "react";
import { PetSessionPanel } from "./PetSessionPanel";
import { PetBookingSelection } from "./PetBookingSelection";
import { PetBookingSlots } from "./PetBookingSlots";
import { PetBookingReview } from "./PetBookingReview";
import { PetBookingSuccess } from "./PetBookingSuccess";
import { usePetBooking } from "../hooks/usePetBooking";
import { canStartPetLogout } from "../session/publicPetRequestUi";
import { petBookingSelectionKey } from "../booking/publicPetBookingState";
import {
  PET_BOOKING_EMPTY_MASCOTAS,
  petBookingDisplayedDurationMinutes,
  petBookingDurationLabel,
  petBookingSlotsView,
  type PetBookingOptionsView,
} from "../booking/publicPetBookingView";
import { getFechaLocal } from "../../../shared/helpers/date.helpers";
import type { PetPublicProfile } from "../session/publicPetSession.service";
import type { PetSessionScopeRef } from "../session/petSessionScope";
import "../styles/publicPetBooking.css";

interface Props {
  slug: string;
  token: string;
  sessionScope: string;
  profile: PetPublicProfile;
  status: "authenticated" | "logging-out";
  onLogout: () => void;
  onSessionInvalid: (scope: PetSessionScopeRef) => void;
}

export function PetBookingFlow({ slug, token, sessionScope, profile, status, onLogout, onSessionInvalid }: Props) {
  const booking = usePetBooking({ slug, token, sessionScope, profile, onSessionInvalid });
  const { draft, options, availability, actions, createdBooking, bookingUnavailable, canConfirm, sessionInvalid, state } = booking;
  const isSubmitting = booking.creation.isPending;
  const mascotas = profile.mascotas;
  const reconcileOptions = actions.reconcileOptions;

  useEffect(() => {
    if (draft.mascotaId === null || !options.data) return;
    reconcileOptions(draft.mascotaId, options.data);
  }, [draft.mascotaId, options.data, reconcileOptions]);

  const servicio = (options.data?.servicios ?? []).find(item => item.id === draft.servicioId) ?? null;
  const extrasSeleccionados = (options.data?.extras ?? []).filter(extra => draft.extraIds.includes(extra.id));
  const selectionKey = petBookingSelectionKey(draft);
  const duracionLabel = petBookingDurationLabel(
    petBookingDisplayedDurationMinutes(availability.data, servicio, extrasSeleccionados),
  );
  const optionsStatus: PetBookingOptionsView = draft.mascotaId === null ? "idle"
    : options.isFetching ? "loading"
      : options.isError ? "error"
        : options.isSuccess ? "ready"
          : "loading";

  return (
    <>
      <PetSessionPanel
        profile={profile}
        showMascotas={false}
        loggingOut={status === "logging-out"}
        onLogout={() => { if (canStartPetLogout(isSubmitting, status)) onLogout(); }}
      />

      {createdBooking ? (
        <PetBookingSuccess success={createdBooking} onNewBooking={actions.startNewBooking} />
      ) : sessionInvalid ? null : bookingUnavailable ? (
        <section className="pet-booking-card pet-booking-empty" role="alert">
          <p>{state.avisoRecuperable}</p>
          <button type="button" className="pet-booking-confirm" onClick={actions.retryBooking}>Volver a intentar</button>
        </section>
      ) : mascotas.length === 0 ? (
        <section className="pet-booking-card pet-booking-empty" role="status">
          <p>{PET_BOOKING_EMPTY_MASCOTAS}</p>
        </section>
      ) : (
        <section className="pet-booking-card" aria-label="Reservar turno">
          <h2>Reservá un turno</h2>

          {state.avisoRecuperable && (
            <p className="pet-booking-notice" role="status">{state.avisoRecuperable}</p>
          )}

          <PetBookingSelection
            mascotas={mascotas}
            mascotaId={draft.mascotaId}
            servicios={options.data?.servicios ?? []}
            servicioId={draft.servicioId}
            extras={options.data?.extras ?? []}
            extraIds={draft.extraIds}
            fecha={draft.fecha}
            minFecha={getFechaLocal()}
            optionsStatus={optionsStatus}
            locked={isSubmitting}
            duracionLabel={duracionLabel}
            onMascota={actions.setMascota}
            onServicio={actions.setServicio}
            onToggleExtra={actions.toggleExtra}
            onFecha={actions.setFecha}
            onRetryOptions={() => { void actions.refetchOptions(); }}
          />

          {servicio && selectionKey !== null && options.isSuccess && (
            <PetBookingSlots
              view={petBookingSlotsView({
                isFetching: availability.isFetching,
                isError: availability.isError,
                slots: availability.data?.slots ?? null,
              })}
              slots={availability.data?.slots ?? []}
              selectionKey={selectionKey}
              selected={draft.slotSeleccionado}
              locked={isSubmitting}
              onSelect={(slot, key) => actions.setSlot({ horaInicio: slot.horaInicio, horaFin: slot.horaFin, selectionKey: key })}
              onRetry={() => { void actions.refetchAvailability(); }}
            />
          )}

          {draft.slotSeleccionado && servicio && (
            <PetBookingReview
              mascotaNombre={mascotas.find(m => m.id === draft.mascotaId)?.nombre ?? ""}
              servicioNombre={servicio.nombre}
              extras={extrasSeleccionados}
              fecha={draft.fecha}
              slot={draft.slotSeleccionado}
              duracionLabel={duracionLabel}
              canConfirm={canConfirm}
              isSubmitting={isSubmitting}
              onConfirm={() => { void actions.confirmar(); }}
            />
          )}
        </section>
      )}
    </>
  );
}
