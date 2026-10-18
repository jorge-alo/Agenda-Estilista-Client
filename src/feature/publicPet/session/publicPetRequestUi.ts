export type PetLandingMode = "loading" | "authenticated" | "error" | "first-visit";

export const PET_SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Volvé a ingresar para reservar.";

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
