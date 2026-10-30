import { useRef, useState, type FormEvent } from "react";
import {
  PET_ACCESS_REQUEST_SUCCESS_MESSAGE,
  petAccessRequestErrorMessage,
  requestPetAccessLink,
  validatePetAccessPhone,
} from "../session/publicPetSession.service";
import { runPetRequestOnce } from "../session/publicPetRequestUi";

type RequestState = "idle" | "submitting" | "submitted" | "error";

interface Props {
  slug: string;
  direct?: boolean;
  onSubmittingChange?: (pending: boolean) => void;
}

export function PetExistingClientAccess({ slug, direct = false, onSubmittingChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [state, setState] = useState<RequestState>("idle");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const submitting = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validatePetAccessPhone(telefono);
    if (validation) {
      setFieldError(validation === "required" ? "Ingresá tu teléfono." : "El teléfono no puede superar 50 caracteres.");
      setState("error");
      return;
    }

    await runPetRequestOnce(submitting, async () => {
      setFieldError(null);
      setRequestError(null);
      setState("submitting");
      onSubmittingChange?.(true);
      try {
        await requestPetAccessLink(slug, telefono);
        setTelefono("");
        setState("submitted");
      } catch (error: unknown) {
        setRequestError(petAccessRequestErrorMessage(error));
        setState("error");
      } finally {
        onSubmittingChange?.(false);
      }
    });
  };

  const reset = () => {
    setTelefono("");
    setFieldError(null);
    setRequestError(null);
    setState("idle");
  };

  return (
    <section className="pet-existing-client" aria-labelledby="pet-existing-client-title">
      <h2 id="pet-existing-client-title">¿Ya sos cliente?</h2>
      {!direct && !expanded ? (
        <button className="pet-existing-client-toggle" type="button" onClick={() => setExpanded(true)}>
          Solicitar acceso
        </button>
      ) : state === "submitted" ? (
        <div className="pet-access-request-success" role="status" aria-live="polite">
          <p>{PET_ACCESS_REQUEST_SUCCESS_MESSAGE}</p>
          <button className="pet-existing-client-toggle" type="button" onClick={reset}>Solicitar otro enlace</button>
        </div>
      ) : (
        <form className="pet-access-request-form" onSubmit={submit} noValidate aria-busy={state === "submitting"}>
          <p>Te enviaremos un enlace de acceso por WhatsApp si hay una cuenta habilitada.</p>
          <div className="pet-form-field">
            <label htmlFor="pet-existing-client-phone">Teléfono</label>
            <input
              id="pet-existing-client-phone"
              type="tel"
              autoComplete="tel"
              maxLength={50}
              value={telefono}
              onChange={event => {
                setTelefono(event.currentTarget.value);
                setFieldError(null);
                setRequestError(null);
                if (state === "error") setState("idle");
              }}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "pet-existing-client-phone-error" : undefined}
              disabled={state === "submitting"}
            />
            {fieldError && <p className="pet-field-error" id="pet-existing-client-phone-error">{fieldError}</p>}
          </div>
          {requestError && <p className="pet-form-global-error" role="alert">{requestError}</p>}
          <button className="pet-submit-button" type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "Enviando…" : "Enviar enlace por WhatsApp"}
          </button>
          {!direct && <button className="pet-existing-client-cancel" type="button" disabled={state === "submitting"} onClick={() => { setExpanded(false); reset(); }}>
            Cancelar
          </button>}
        </form>
      )}
    </section>
  );
}
