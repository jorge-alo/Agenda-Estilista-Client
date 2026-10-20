import { useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import { MASCOTA_DATA_FIELDS, MASCOTA_TEXT_LIMITS, type MascotaDataField } from "../forms/petMascotaForm.ts";
import {
  MASCOTA_REMOTE_CHANGED, type PetMascotaFormController, type PetMascotaFormSnapshot,
} from "../state/petMascotaFormController.ts";

const LABELS: Record<MascotaDataField, string> = {
  nombre: "Nombre", raza: "Raza", fecha_nacimiento: "Fecha de nacimiento", sexo: "Sexo",
  tamano: "Tamaño", tipo_pelo: "Tipo de pelo", observaciones: "Observaciones",
};

export function PetMascotaDataForm({ controller, state }: {
  controller: PetMascotaFormController;
  state: PetMascotaFormSnapshot;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const creating = state.mode === "creating" || state.mode === "submittingCreate";
  const prefix = creating ? "pet-mascota-create" : "pet-mascota-edit";
  useEffect(() => {
    const input = formRef.current?.elements.namedItem("nombre");
    if (input instanceof HTMLInputElement) input.focus();
  }, [creating]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await controller.submit()) return;
    const errors = controller.getSnapshot().errors;
    const field = MASCOTA_DATA_FIELDS.find(key => errors[key]);
    const input = field ? formRef.current?.elements.namedItem(field) : null;
    if (input instanceof HTMLElement) input.focus();
  }

  return (
    <form ref={formRef} className="pet-management__form" onSubmit={handleSubmit} noValidate aria-labelledby={`${prefix}-title`}>
      {creating ? <h2 id={`${prefix}-title`}>Nueva mascota</h2> : <h5 id={`${prefix}-title`}>Editar datos</h5>}
      {state.errorMessage && <p className="pet-management__alert" role="alert">{state.errorMessage}</p>}
      {state.serverChanged && <p className="pet-management__alert" role="status">{MASCOTA_REMOTE_CHANGED}</p>}
      {state.checking && <p role="status">Verificando la ficha sin descartar tus cambios…</p>}
      {state.needsRefresh && !state.checking && (
        <button type="button" className="pet-management__secondary" onClick={() => { void controller.verifyDetail(); }}>
          Reintentar verificación de ficha
        </button>
      )}
      <fieldset disabled={state.submitting || state.checking} className="pet-management__form-fields">
        <legend className="pet-management__sr-only">Datos básicos de la mascota</legend>
        {MASCOTA_DATA_FIELDS.map(field => {
          const id = `${prefix}-${field}`;
          const error = state.errors[field];
          const shared = {
            id, name: field, value: state.draft[field], required: field === "nombre",
            "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => controller.change(field, event.target.value),
          };
          const limit = field in MASCOTA_TEXT_LIMITS ? MASCOTA_TEXT_LIMITS[field as keyof typeof MASCOTA_TEXT_LIMITS] : undefined;
          return (
            <div key={field} className={field === "observaciones" ? "pet-management__form-wide" : undefined}>
              <label htmlFor={id}>{LABELS[field]}{field === "nombre" ? " *" : ""}</label>
              {field === "observaciones" ? <textarea {...shared} rows={4} /> : (
                <input {...shared} type={field === "fecha_nacimiento" ? "date" : "text"} maxLength={limit}
                  max={field === "fecha_nacimiento" ? "9999-12-31" : undefined} />
              )}
              {error && <p id={`${id}-error`} className="pet-management__field-error">{error}</p>}
            </div>
          );
        })}
      </fieldset>
      <div className="pet-management__form-actions">
        <button className="pet-management__primary" type="submit"
          disabled={state.submitting || state.checking || state.needsRefresh || (!creating && !state.dirty)}>
          {state.submitting ? "Guardando…" : creating ? "Crear mascota" : "Guardar datos"}
        </button>
        <button className="pet-management__secondary" type="button" onClick={controller.cancel}
          disabled={state.submitting || state.checking}>Cancelar</button>
      </div>
    </form>
  );
}
