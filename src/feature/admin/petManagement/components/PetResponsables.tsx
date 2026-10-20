import { useEffect, useRef, type FormEvent } from "react";
import type { PetManagementResponsable } from "../types/petManagement.types.ts";
import type { PetResponsablesController, PetResponsablesSnapshot } from "../state/petResponsablesController.ts";

function ResponsableForm({ controller, state }: { controller: PetResponsablesController; state: PetResponsablesSnapshot }) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { (formRef.current?.elements.namedItem("nombre") as HTMLInputElement | null)?.focus(); }, []);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await controller.submit()) return;
    const errors = controller.getSnapshot().errors;
    const field = errors.nombre ? "nombre" : errors.telefono ? "telefono" : null;
    const input = field ? formRef.current?.elements.namedItem(field) : null;
    if (input instanceof HTMLElement) input.focus();
  }
  return (
    <form ref={formRef} className="pet-management__form" noValidate onSubmit={handleSubmit} aria-labelledby="pet-responsable-add-title">
      <h5 id="pet-responsable-add-title">Agregar responsable</h5>
      {state.confirmed && <p className="pet-management__hint">Registro confirmado: <strong>{state.confirmed.nombre}</strong> · {state.confirmed.telefono}</p>}
      <fieldset className="pet-management__form-fields" disabled={state.busy || state.confirmed !== null || state.verification !== null}>
        <legend className="pet-management__sr-only">Datos del responsable</legend>
        {(["nombre", "telefono"] as const).map(field => {
          const error = state.errors[field];
          const id = `pet-responsable-${field}`;
          return (
            <div key={field}>
              <label htmlFor={id}>{field === "nombre" ? "Nombre" : "Teléfono"} *</label>
              <input id={id} name={field} type={field === "telefono" ? "tel" : "text"} required
                maxLength={field === "nombre" ? 255 : 50} value={state.draft[field]}
                autoComplete={field === "nombre" ? "name" : "tel"}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                onChange={event => controller.change(field, event.target.value)} />
              {error && <p id={`${id}-error`} className="pet-management__field-error">{error}</p>}
            </div>
          );
        })}
      </fieldset>
      <div className="pet-management__form-actions">
        <button className="pet-management__primary" type="submit" disabled={state.busy || state.verification !== null}>
          {state.busy ? "Procesando…" : state.confirmed ? "Reintentar asociación" : "Guardar y asociar"}
        </button>
        <button className="pet-management__secondary" type="button" onClick={controller.cancel} disabled={state.busy}>Cancelar</button>
      </div>
    </form>
  );
}

export function PetResponsables({ responsables, controller, state, disabled }: {
  responsables: PetManagementResponsable[];
  controller: PetResponsablesController;
  state: PetResponsablesSnapshot;
  disabled: boolean;
}) {
  const adding = ["adding", "creating", "associating"].includes(state.mode)
    || (state.mode === "checking" && state.confirmed !== null);
  return (
    <section className="pet-management__detail-section" aria-labelledby="pet-management-responsables-title" aria-busy={state.busy}>
      <div className="pet-management__responsables-heading">
        <h4 id="pet-management-responsables-title" tabIndex={-1}>Responsables ({responsables.length})</h4>
        {!adding && <button className="pet-management__secondary" type="button" onClick={controller.beginAdd}
          disabled={disabled || state.busy || state.verification !== null}>Agregar responsable</button>}
      </div>
      {state.notice && <p className="pet-management__status" role="status">{state.notice}</p>}
      {state.errorMessage && <p className="pet-management__alert" role="alert">{state.errorMessage}</p>}
      {state.mode === "checking" && <p className="pet-management__status" role="status">Verificando responsables desde la ficha…</p>}
      {state.verification && !state.busy && <button className="pet-management__secondary" type="button" onClick={() => { void controller.verify(); }}>
        Reintentar verificación de ficha
      </button>}
      {responsables.length === 0 ? <p className="pet-management__hint">Sin responsables asociados.</p> : (
        <ul className="pet-management__responsables">
          {responsables.map(responsable => (
            <li key={responsable.id}>
              <div className="pet-management__responsable-info"><strong>{responsable.nombre}</strong><span>{responsable.telefono}</span></div>
              <button className="pet-management__secondary" type="button" aria-label={`Quitar a ${responsable.nombre} de esta mascota`}
                disabled={disabled || state.mode !== "viewing" || state.verification !== null}
                onClick={() => { void controller.removeResponsable(responsable.id); }}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {adding && <ResponsableForm controller={controller} state={state} />}
    </section>
  );
}
