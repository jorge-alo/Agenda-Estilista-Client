import { PublicPetRequestError } from "../types/publicPet.types.ts";

export type PetLandingMode = "loading" | "authenticated" | "error" | "first-visit";

export const PET_SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Volvé a ingresar para reservar.";
/** Canonical copy for PET_BOOKING_UNAVAILABLE; booking reads the same text from the reducer notice. */
export const PET_BOOKING_UNAVAILABLE_MESSAGE = "Las reservas online no están disponibles en este momento.";

export function petFirstVisitRequestErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (!(error instanceof PublicPetRequestError)) return "No pudimos enviar la solicitud. Intentá nuevamente.";
  if (error.status === 400) return "Revisá los datos ingresados.";
  if (error.status === 404) return "Este local no está disponible.";
  if (error.status === 409 && error.code === "PET_BOOKING_UNAVAILABLE") return PET_BOOKING_UNAVAILABLE_MESSAGE;
  if (error.status === 429) return "Se enviaron demasiadas solicitudes. Intentá nuevamente más tarde.";
  return "No pudimos enviar la solicitud. Intentá nuevamente.";
}

export function getPetLandingMode(status: string): PetLandingMode {
  if (status === "loading" || status === "logging-out") return "loading";
  if (status === "authenticated") return "authenticated";
  if (status === "error") return "error";
  return "first-visit";
}

/** A creation in flight must finish (or be left alone) before the session can be closed. */
export function canStartPetLogout(isSubmitting: boolean, status: string): boolean {
  return !isSubmitting && status === "authenticated";
}

/** Successful access lands on the canonical local path; never a fragment or query with the challenge. */
export function petAccessRedirectPath(status: string, slug: string): string | null {
  return status === "authenticated" ? `/${encodeURIComponent(slug)}` : null;
}

export async function runPetRequestOnce(
  pending: { current: boolean },
  operation: () => Promise<void>,
): Promise<boolean> {
  if (pending.current) return false;
  pending.current = true;
  try {
    await operation();
    return true;
  } finally {
    pending.current = false;
  }
}
