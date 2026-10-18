const SAFE_BACKEND_CODES = new Set([
  "PET_SESSION_INVALID",
  "PET_BOOKING_INVALID",
  "PET_MASCOTA_UNAVAILABLE",
  "PET_SERVICE_UNAVAILABLE",
  "PET_EXTRA_UNAVAILABLE",
  "PET_SLOT_UNAVAILABLE",
  "PET_BOOKING_UNAVAILABLE",
  "PET_LOCAL_NOT_FOUND",
  "PET_SOLICITUD_INVALID_BODY",
  "INVALID_JSON",
  "INTERNAL_SERVER_ERROR",
]);

export class PublicPetHttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super("PUBLIC_PET_HTTP_ERROR");
    this.name = "PublicPetHttpError";
    this.status = status;
    this.code = code;
  }
}

function safeCode(value: unknown): string | null {
  return typeof value === "string" && SAFE_BACKEND_CODES.has(value) ? value : null;
}

export async function publicPetHttpErrorFromResponse(response: Response): Promise<PublicPetHttpError> {
  let code: string | null = null;
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const result = payload as Record<string, unknown>;
      code = safeCode(result.error) ?? safeCode(result.code);
    }
  } catch {
    // Proxy HTML, arbitrary text and malformed JSON are never copied into errors.
  }
  return new PublicPetHttpError(response.status, code);
}

export function isPublicPetAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true
    || (error instanceof Error && error.name === "AbortError");
}

export function publicPetNetworkError(): PublicPetHttpError {
  return new PublicPetHttpError(0, null);
}

export function publicPetProtocolError(status: number): PublicPetHttpError {
  return new PublicPetHttpError(status, null);
}
