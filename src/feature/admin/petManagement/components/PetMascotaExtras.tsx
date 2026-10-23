import type { usePetMascotaExtras } from "../hooks/usePetMascotaExtras.ts";
import { parsePetExtraDuracion, petMascotaExtrasError } from "../types/petMascotaExtras.types.ts";

export function PetMascotaExtras({ extras, disabled }: {
  extras: ReturnType<typeof usePetMascotaExtras>;
  disabled: boolean;
}) {
  const { controller, state, loading, fetching, error, refresh } = extras;
  const blocked = disabled || state.busy || Boolean(state.verification) || fetching || Boolean(error);
  return <section className="pet-management__detail-section" aria-labelledby="pet-management-extras-title" aria-busy={state.busy || fetching}>
    <div className="pet-management__responsables-heading">
      <h4 id="pet-management-extras-title">Extras permitidos</h4>
      <button type="button" className="pet-management__secondary" onClick={refresh} disabled={state.busy || fetching}>Actualizar extras</button>
    </div>
    <p className="pet-management__hint">Elegí los extras del catálogo que pueden aplicarse a esta mascota y cuántos minutos adicionales suma cada uno. Esto no habilita la reserva online.</p>
    {loading && <p role="status">Cargando extras…</p>}
    {error && <p className="pet-management__alert" role="alert">{petMascotaExtrasError(error)}</p>}
    {state.errorMessage && <p className="pet-management__alert" role="alert">{state.errorMessage}</p>}
    {state.notice && <p className="pet-management__status" role="status">{state.notice}</p>}
    {state.verification && <button type="button" className="pet-management__secondary" disabled={state.busy}
      onClick={() => void controller.verify()}>Verificar nuevamente</button>}
    {!loading && !error && state.rows.length === 0 && <p className="pet-management__hint">No hay extras en el catálogo del local. Podés crearlos desde Extras.</p>}
    <ul className="pet-management__service-list">
      {state.rows.map(row => {
        const fieldId = `pet-extra-duration-${row.id}`;
        const parsedDuration = parsePetExtraDuracion(row.value);
        return <li key={row.id} className="pet-management__service-card">
          <div className="pet-management__result-heading"><strong>{row.nombre} <small>#{row.id}</small></strong>
            <span className={`pet-management__badge${row.activo ? "" : " is-inactive"}`}>{row.activo ? "Activo" : "Inactivo"}</span></div>
          <p className="pet-management__hint">{row.permitido ? "Permitido para esta mascota" : "Sin permitir"}</p>
          {row.permitido && row.duracionAdicionalMinutos !== null && <p className="pet-management__hint">Tiempo adicional configurado: +{row.duracionAdicionalMinutos} min.</p>}
          {!row.activo && <p className="pet-management__hint">{row.permitido
            ? "Este extra está desactivado en el catálogo y no está disponible para nuevas reservas. Su configuración de minutos adicionales se conserva."
            : "No disponible para nuevas configuraciones."}</p>}
          {!row.activo && !row.permitido && state.drafts[row.id] && <>
            <p className="pet-management__hint">Minutos adicionales sin guardar: {row.value || "—"} min. El extra ya no admite nuevas configuraciones.</p>
            <button type="button" className="pet-management__secondary" disabled={state.busy || Boolean(state.verification)}
              onClick={() => controller.discard(row.id)}>Descartar edición</button>
          </>}
          {(row.activo || row.permitido) && <form className="pet-management__form" onSubmit={event => { event.preventDefault(); if (!blocked) void controller.save(row.id); }}>
            <fieldset className="pet-management__service-fields" disabled={blocked}>
              <label className="pet-management__field" htmlFor={fieldId}>Tiempo adicional (min)
                <input id={fieldId} type="text" inputMode="numeric" autoComplete="off" value={row.value}
                  aria-invalid={Boolean(row.error)} aria-describedby={row.error ? `${fieldId}-error` : undefined}
                  onChange={event => controller.change(row.id, event.target.value)} />
              </label>
              <button type="submit" className="pet-management__primary"
                disabled={parsedDuration === null || (row.permitido && parsedDuration === row.duracionAdicionalMinutos)}
                aria-label={`${row.permitido ? "Guardar tiempo adicional de" : "Permitir"} ${row.nombre} #${row.id}`}>
                {row.permitido ? "Guardar tiempo adicional" : "Permitir extra"}
              </button>
              {state.drafts[row.id] && <button type="button" className="pet-management__secondary" onClick={() => controller.discard(row.id)}>Descartar edición</button>}
            </fieldset>
            {row.error && <p id={`${fieldId}-error`} className="pet-management__field-error" role="alert">{row.error}</p>}
            {row.value !== "" && parsePetExtraDuracion(row.value) === null && !row.error && <p className="pet-management__field-error">Ingresá un entero entre 1 y 2147483647 min.</p>}
            {row.serverChanged && <p className="pet-management__alert" role="status">La configuración cambió en el servidor. Conservamos tu edición. Descartala para cargar los minutos adicionales actuales o guardá tus cambios.</p>}
          </form>}
          {row.permitido && <button type="button" className="pet-management__secondary" disabled={blocked}
            aria-label={`Quitar ${row.nombre} #${row.id} de esta mascota`}
            onClick={() => void controller.remove(row.id)}>Quitar de esta mascota</button>}
        </li>;
      })}
    </ul>
  </section>;
}
