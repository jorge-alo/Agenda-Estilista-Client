import { usePetAdminBooking } from "../hooks/usePetAdminBooking.ts";
import { petAdminBookingIssueMessage, petAdminDateLabel, petAdminSlotLabel } from "../booking/petAdminBookingView.ts";
import { PetAdminPetSearch } from "./PetAdminPetSearch.tsx";
import "../styles/petAdminBooking.css";

function Loading({ children }: { children: string }) {
  return <p className="pet-admin-booking__message" role="status">{children}</p>;
}

export function PetAdminBookingForm() {
  const booking = usePetAdminBooking();
  const { draft } = booking;
  const actions = booking.actions;
  const disabled = booking.isSubmitting || booking.unauthorized;
  const globalMessage = petAdminBookingIssueMessage(booking.issue);
  const detailForPet = booking.queries.detail.data?.id === draft.mascotaId ? booking.queries.detail.data : null;
  const responsibleIsSelected = booking.responsables.some(item => item.clienteId === draft.clienteId);
  const availability = booking.availability;
  const availabilityIsCurrent = availability.data?.fecha === draft.fecha;

  if (booking.createdBooking) {
    const success = booking.createdBooking;
    return (
      <section className="pet-admin-booking" aria-labelledby="pet-admin-booking-success-title">
        <div className="pet-admin-booking__success" role="status">
          <h2 id="pet-admin-booking-success-title">Turno confirmado</h2>
          <dl className="pet-admin-booking__summary-list">
            <div><dt>Mascota</dt><dd>{success.mascotaNombre}</dd></div>
            <div><dt>Responsable</dt><dd>{success.responsableNombre}</dd></div>
            <div><dt>Servicio</dt><dd>{success.servicioNombre}</dd></div>
            <div><dt>Fecha</dt><dd>{petAdminDateLabel(success.fecha)}</dd></div>
            <div><dt>Horario</dt><dd>{petAdminSlotLabel(success.hora, success.horaFin)}</dd></div>
          </dl>
          <button className="pet-admin-booking__primary" type="button" onClick={actions.startNewBooking}>
            Reservar otro turno
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="pet-admin-booking" aria-labelledby="pet-admin-booking-title" aria-busy={booking.isSubmitting}>
      <header className="pet-admin-booking__header">
        <h1 id="pet-admin-booking-title">Reservar turno PET</h1>
        <p>Elegí una mascota, su responsable y el horario.</p>
      </header>

      {globalMessage && <p className="pet-admin-booking__alert" role="alert">{globalMessage}</p>}

      <form className="pet-admin-booking__form" onSubmit={event => {
        event.preventDefault();
        void actions.confirmar();
      }}>
        <fieldset className="pet-admin-booking__group" disabled={disabled}>
          <legend>Mascota</legend>
          <PetAdminPetSearch
            disabled={disabled}
            selectedMascotaId={draft.mascotaId}
            selectedDetail={booking.selectedPetDetail}
            searchResults={booking.searchResults}
            searchLoading={booking.searchLoading}
            searchFailed={booking.searchError !== null}
            onActivate={() => actions.setSearchActive(true)}
            onSearch={actions.setSearchTerm}
            onClearSearch={actions.clearSearch}
            onRetry={() => void actions.refetchSearch()}
            onSelect={actions.setMascota}
          />
        </fieldset>

        {draft.mascotaId !== null && (
          <>
            <fieldset className="pet-admin-booking__group" disabled={disabled}>
              <legend>Responsable</legend>
              {booking.queries.detail.isLoading ? <Loading>Buscando responsables…</Loading>
                : booking.queries.detail.isError ? (
                  <div className="pet-admin-booking__message" role="alert">
                    <p>No pudimos cargar los responsables de esta mascota.</p>
                    <button type="button" onClick={() => void actions.refetchDetail()}>Reintentar</button>
                  </div>
                ) : detailForPet?.responsables.length === 0 ? (
                  <p className="pet-admin-booking__message" role="status">Esta mascota no tiene un responsable asociado.</p>
                ) : detailForPet?.responsables.length === 1 ? (
                  <div className="pet-admin-booking__responsible" aria-live="polite">
                    <strong>{detailForPet.responsables[0].nombre}</strong>
                    <span>{detailForPet.responsables[0].telefono}</span>
                  </div>
                ) : detailForPet ? (
                  <label className="pet-admin-booking__field">
                    <span>Elegir responsable</span>
                    <select value={draft.clienteId ?? ""} onChange={event => actions.setCliente(event.target.value ? Number(event.target.value) : null)}>
                      <option value="">Seleccioná un responsable</option>
                      {detailForPet.responsables.map(responsable => (
                        <option key={responsable.clienteId} value={responsable.clienteId}>
                          {responsable.nombre} — {responsable.telefono}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : <Loading>Buscando responsables…</Loading>}
              {detailForPet && responsibleIsSelected && detailForPet.responsables.length > 1 && (
                <p className="pet-admin-booking__hint">
                  {booking.responsables.find(item => item.clienteId === draft.clienteId)?.telefono}
                </p>
              )}
            </fieldset>

            <fieldset className="pet-admin-booking__group" disabled={disabled}>
              <legend>Servicio</legend>
              {booking.queries.servicios.isLoading ? <Loading>Buscando servicios…</Loading>
                : booking.queries.servicios.isError ? (
                  <div className="pet-admin-booking__message" role="alert">
                    <p>No pudimos cargar los servicios. Intentá nuevamente.</p>
                    <button type="button" onClick={() => void actions.refetchServicios()}>Reintentar</button>
                  </div>
                ) : booking.servicios.length === 0 ? (
                  <p className="pet-admin-booking__message">No hay servicios activos configurados para esta mascota.</p>
                ) : (
                  <label className="pet-admin-booking__field">
                    <span>Elegir servicio</span>
                    <select value={draft.servicioId ?? ""} onChange={event => actions.setServicio(event.target.value ? Number(event.target.value) : null)}>
                      <option value="" disabled>Seleccioná un servicio</option>
                      {booking.servicios.map(servicio => (
                        <option key={servicio.id} value={servicio.id}>{servicio.nombre} — {servicio.duracionMinutos} min</option>
                      ))}
                    </select>
                  </label>
                )}
            </fieldset>

            {draft.servicioId !== null && (
              <fieldset className="pet-admin-booking__group" disabled={disabled}>
                <legend>Extras (opcionales)</legend>
                {booking.queries.extras.isLoading ? <Loading>Buscando extras…</Loading>
                  : booking.queries.extras.isError ? (
                    <div className="pet-admin-booking__message" role="alert">
                      <p>No pudimos cargar los extras. Intentá nuevamente.</p>
                      <button type="button" onClick={() => void actions.refetchExtras()}>Reintentar</button>
                    </div>
                  ) : booking.extras.length === 0 ? (
                    <p className="pet-admin-booking__hint">No hay extras activos para esta mascota.</p>
                  ) : (
                    <div className="pet-admin-booking__checks">
                      {booking.extras.map(extra => (
                        <label className="pet-admin-booking__check" key={extra.id}>
                          <input type="checkbox" checked={draft.extraIds.includes(extra.id)} onChange={() => actions.toggleExtra(extra.id)} />
                          <span>{extra.nombre} (+{extra.duracionMinutos} min)</span>
                        </label>
                      ))}
                    </div>
                  )}
              </fieldset>
            )}

            {draft.servicioId !== null && (
              <fieldset className="pet-admin-booking__group" disabled={disabled}>
                <legend>Fecha</legend>
                <label className="pet-admin-booking__field">
                  <span>Elegir fecha</span>
                  <input type="date" value={draft.fecha} onChange={event => actions.setFecha(event.target.value)} />
                </label>
              </fieldset>
            )}
          </>
        )}

        {draft.servicioId !== null && draft.fecha !== "" && (
          <fieldset className="pet-admin-booking__group" disabled={disabled}>
            <legend>Horario</legend>
            {availability.isFetching ? <Loading>Buscando horarios disponibles…</Loading>
              : availability.isError ? (
                <div className="pet-admin-booking__message" role="alert">
                  <p>No pudimos cargar los horarios. Intentá nuevamente.</p>
                  <button type="button" onClick={() => void actions.refetchAvailability()}>Reintentar</button>
                </div>
              ) : availability.isSuccess && availabilityIsCurrent && availability.data.slots.length === 0 ? (
                <p className="pet-admin-booking__message">No hay horarios disponibles para esta fecha.</p>
              ) : availability.isSuccess && availabilityIsCurrent ? (
                <div className="pet-admin-booking__slots">
                  {availability.data.slots.map(slot => {
                    const selected = draft.slotSeleccionado?.horaInicio === slot.horaInicio && draft.slotSeleccionado.horaFin === slot.horaFin;
                    return (
                      <label className={`pet-admin-booking__slot${selected ? " is-selected" : ""}`} key={`${slot.horaInicio}-${slot.horaFin}`}>
                        <input type="radio" name="pet-admin-slot" checked={selected} onChange={() => actions.setSlot(slot)} />
                        <span>{petAdminSlotLabel(slot.horaInicio, slot.horaFin)}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
          </fieldset>
        )}

        {booking.canConfirm && (
          <section className="pet-admin-booking__review" aria-labelledby="pet-admin-booking-review-title">
            <h2 id="pet-admin-booking-review-title">Resumen del turno</h2>
            <dl className="pet-admin-booking__summary-list">
              <div><dt>Mascota</dt><dd>{booking.selectedPetDetail?.nombre}</dd></div>
              <div><dt>Responsable</dt><dd>{booking.responsables.find(item => item.clienteId === draft.clienteId)?.nombre}</dd></div>
              <div><dt>Teléfono</dt><dd>{booking.responsables.find(item => item.clienteId === draft.clienteId)?.telefono}</dd></div>
              <div><dt>Servicio</dt><dd>{booking.servicios.find(item => item.id === draft.servicioId)?.nombre}</dd></div>
              <div><dt>Extras</dt><dd>{draft.extraIds.length
                ? booking.extras.filter(item => draft.extraIds.includes(item.id)).map(item => item.nombre).join(", ")
                : "Sin extras"}</dd></div>
              <div><dt>Fecha</dt><dd>{petAdminDateLabel(draft.fecha)}</dd></div>
              <div><dt>Horario</dt><dd>{draft.slotSeleccionado && petAdminSlotLabel(draft.slotSeleccionado.horaInicio, draft.slotSeleccionado.horaFin)}</dd></div>
              <div><dt>Duración</dt><dd>{availability.data?.duracionMinutos} min</dd></div>
            </dl>
            <button className="pet-admin-booking__primary" type="submit" disabled={disabled || !booking.canConfirm}>
              {booking.isSubmitting ? "Confirmando turno…" : "Confirmar turno"}
            </button>
          </section>
        )}

        {booking.isSubmitting && <p className="pet-admin-booking__message" role="status">Confirmando turno…</p>}
      </form>
    </section>
  );
}
