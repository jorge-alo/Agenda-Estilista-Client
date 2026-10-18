export type PetLandingMode = "loading" | "authenticated" | "error" | "first-visit";

export function getPetLandingMode(status: string): PetLandingMode {
  if (status === "loading" || status === "logging-out") return "loading";
  if (status === "authenticated") return "authenticated";
  if (status === "error") return "error";
  return "first-visit";
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
