import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreatePetRequest } from "../hooks/useCreatePetRequest";
import { petFirstVisitSchema, type PetFirstVisitData, type PetFirstVisitInput } from "../schemas/petFirstVisit.schema";
import { PublicPetRequestError } from "../types/publicPet.types";

interface Props {
  slug: string;
}

export function PetFirstVisitForm({ slug }: Props) {
  const mutation = useCreatePetRequest(slug);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PetFirstVisitInput, unknown, PetFirstVisitData>({
    resolver: zodResolver(petFirstVisitSchema),
    defaultValues: {
      responsableNombre: "",
      responsableTelefono: "",
      responsableTelefonoSecundario: "",
      mascotaNombre: "",
      mascotaRaza: "",
      mascotaFechaNacimiento: "",
      mascotaTamano: "",
      mascotaSexo: "",
      motivoContacto: "",
    },
  });

  if (mutation.isSuccess) {
    return (
      <section className="pet-request-success" role="status" aria-live="polite">
        <span className="pet-request-success-icon" aria-hidden="true">✓</span>
        <h2>Solicitud enviada</h2>
        <p>El local recibió tus datos y podrá contactarte para coordinar la primera visita.</p>
      </section>
    );
  }

  const globalError = mutation.error instanceof PublicPetRequestError
    ? mutation.error.status === 400
      ? "Revisá los datos ingresados."
      : mutation.error.status === 404
        ? "Este local no está disponible."
        : mutation.error.status === 429
          ? "Se enviaron demasiadas solicitudes. Intentá nuevamente más tarde."
          : "No pudimos enviar la solicitud. Intentá nuevamente."
    : mutation.error
      ? "No pudimos enviar la solicitud. Intentá nuevamente."
      : null;

  const onSubmit = handleSubmit(values => mutation.mutate(values));

  return (
    <form className="pet-first-visit-form" onSubmit={onSubmit} noValidate aria-busy={mutation.isPending}>
      <fieldset disabled={mutation.isPending}>
        <legend>Tus datos</legend>
        <div className="pet-form-field">
          <label htmlFor="pet-responsable-nombre">Nombre y apellido <span aria-hidden="true">*</span></label>
          <input
            id="pet-responsable-nombre"
            autoComplete="name"
            maxLength={255}
            aria-invalid={Boolean(errors.responsableNombre)}
            aria-describedby={errors.responsableNombre ? "pet-responsable-nombre-error" : undefined}
            {...register("responsableNombre")}
          />
          {errors.responsableNombre && <p className="pet-field-error" id="pet-responsable-nombre-error">{errors.responsableNombre.message}</p>}
        </div>

        <div className="pet-form-field">
          <label htmlFor="pet-responsable-telefono">Teléfono principal <span aria-hidden="true">*</span></label>
          <input
            id="pet-responsable-telefono"
            type="tel"
            autoComplete="tel"
            maxLength={50}
            aria-invalid={Boolean(errors.responsableTelefono)}
            aria-describedby={errors.responsableTelefono ? "pet-responsable-telefono-error" : undefined}
            {...register("responsableTelefono")}
          />
          {errors.responsableTelefono && <p className="pet-field-error" id="pet-responsable-telefono-error">{errors.responsableTelefono.message}</p>}
        </div>

        <div className="pet-form-field">
          <label htmlFor="pet-responsable-telefono-secundario">Segundo teléfono (opcional)</label>
          <input
            id="pet-responsable-telefono-secundario"
            type="tel"
            maxLength={50}
            autoComplete="tel-national"
            aria-invalid={Boolean(errors.responsableTelefonoSecundario)}
            aria-describedby={errors.responsableTelefonoSecundario ? "pet-responsable-telefono-secundario-error" : undefined}
            {...register("responsableTelefonoSecundario")}
          />
          {errors.responsableTelefonoSecundario && <p className="pet-field-error" id="pet-responsable-telefono-secundario-error">{errors.responsableTelefonoSecundario.message}</p>}
        </div>
      </fieldset>

      <fieldset disabled={mutation.isPending}>
        <legend>Datos de tu mascota</legend>
        <div className="pet-form-field">
          <label htmlFor="pet-mascota-nombre">Nombre de tu mascota <span aria-hidden="true">*</span></label>
          <input
            id="pet-mascota-nombre"
            maxLength={255}
            aria-invalid={Boolean(errors.mascotaNombre)}
            aria-describedby={errors.mascotaNombre ? "pet-mascota-nombre-error" : undefined}
            {...register("mascotaNombre")}
          />
          {errors.mascotaNombre && <p className="pet-field-error" id="pet-mascota-nombre-error">{errors.mascotaNombre.message}</p>}
        </div>

        <div className="pet-form-field">
          <label htmlFor="pet-mascota-raza">Raza (opcional)</label>
          <input
            id="pet-mascota-raza"
            maxLength={100}
            aria-invalid={Boolean(errors.mascotaRaza)}
            aria-describedby={errors.mascotaRaza ? "pet-mascota-raza-error" : undefined}
            {...register("mascotaRaza")}
          />
          {errors.mascotaRaza && <p className="pet-field-error" id="pet-mascota-raza-error">{errors.mascotaRaza.message}</p>}
        </div>

        <div className="pet-form-field">
          <label htmlFor="pet-mascota-fecha">Fecha de nacimiento (opcional)</label>
          <input
            id="pet-mascota-fecha"
            type="date"
            aria-invalid={Boolean(errors.mascotaFechaNacimiento)}
            aria-describedby={errors.mascotaFechaNacimiento ? "pet-mascota-fecha-error" : undefined}
            {...register("mascotaFechaNacimiento")}
          />
          {errors.mascotaFechaNacimiento && <p className="pet-field-error" id="pet-mascota-fecha-error">{errors.mascotaFechaNacimiento.message}</p>}
        </div>

        <div className="pet-form-grid">
          <div className="pet-form-field">
            <label htmlFor="pet-mascota-tamano">Tamaño (opcional)</label>
            <input
              id="pet-mascota-tamano"
              maxLength={20}
              aria-invalid={Boolean(errors.mascotaTamano)}
              aria-describedby={errors.mascotaTamano ? "pet-mascota-tamano-error" : undefined}
              {...register("mascotaTamano")}
            />
            {errors.mascotaTamano && <p className="pet-field-error" id="pet-mascota-tamano-error">{errors.mascotaTamano.message}</p>}
          </div>
          <div className="pet-form-field">
            <label htmlFor="pet-mascota-sexo">Sexo (opcional)</label>
            <input
              id="pet-mascota-sexo"
              maxLength={20}
              aria-invalid={Boolean(errors.mascotaSexo)}
              aria-describedby={errors.mascotaSexo ? "pet-mascota-sexo-error" : undefined}
              {...register("mascotaSexo")}
            />
            {errors.mascotaSexo && <p className="pet-field-error" id="pet-mascota-sexo-error">{errors.mascotaSexo.message}</p>}
          </div>
        </div>
      </fieldset>

      <div className="pet-form-field">
        <label htmlFor="pet-motivo">¿Qué necesitás o qué querés contarnos? (opcional)</label>
        <textarea
          id="pet-motivo"
          rows={4}
          maxLength={500}
          aria-invalid={Boolean(errors.motivoContacto)}
          aria-describedby={errors.motivoContacto ? "pet-motivo-error" : "pet-motivo-hint"}
          {...register("motivoContacto")}
        />
        <span className="pet-field-hint" id="pet-motivo-hint">Hasta 500 caracteres</span>
        {errors.motivoContacto && <p className="pet-field-error" id="pet-motivo-error">{errors.motivoContacto.message}</p>}
      </div>

      {globalError && <p className="pet-form-global-error" role="alert" aria-live="polite">{globalError}</p>}

      <button className="pet-submit-button" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Enviando solicitud…" : "Enviar solicitud"}
      </button>
      <p className="pet-required-hint">Los campos con * son obligatorios.</p>
    </form>
  );
}
