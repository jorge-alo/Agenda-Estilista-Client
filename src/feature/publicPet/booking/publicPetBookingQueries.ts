import { queryOptions, type MutationObserverOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys.ts";
import { publicPetBookingService } from "../services/publicPetBooking.service.ts";
import { PublicPetHttpError, publicPetProtocolError } from "../services/publicPetHttp.ts";
import { isPetBookingDate, type PetBookingSuccessBase } from "./publicPetBookingState.ts";
import type {
  PetAvailabilityInput, PetBookingContext, PetCreatedBooking, PetCreateBookingInput,
} from "../types/publicPetBooking.types.ts";

export interface PetBookingScope {
  slug: string;
  /** External, non-secret, memory-only ID. F.4 must rotate it for each new session. */
  sessionScope: string;
}
export interface ScopedPetBookingContext extends PetBookingContext, PetBookingScope {}

const readingPolicy = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
} as const;

function validId(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

function readyContext(context: ScopedPetBookingContext): boolean {
  return context.slug.trim().length > 0 && context.slug.length <= 100
    && context.token.trim().length > 0 && context.sessionScope.trim().length > 0;
}

export function petBookingOptionsQuery(context: ScopedPetBookingContext, mascotaId: number | null, allowReads = true) {
  const auth = { slug: context.slug, token: context.token };
  const enabled = allowReads && readyContext(context) && validId(mascotaId);
  return queryOptions({
    ...readingPolicy,
    queryKey: queryKeys.petBooking.options(context.slug, context.sessionScope, mascotaId),
    enabled,
    queryFn: ({ signal }) => {
      if (!enabled || mascotaId === null) throw new PublicPetHttpError(0);
      return publicPetBookingService.getOpcionesReserva(auth, mascotaId, { signal });
    },
  });
}

export function petBookingAvailabilityQuery(context: ScopedPetBookingContext, input: PetAvailabilityInput | null, allowReads = true) {
  const auth = { slug: context.slug, token: context.token };
  const selection = input ? { mascotaId: input.mascotaId, servicioId: input.servicioId,
    extraIds: [...input.extraIds].sort((a, b) => a - b), fecha: input.fecha } : null;
  const enabled = allowReads && readyContext(context) && selection !== null
    && validId(selection.mascotaId) && validId(selection.servicioId)
    && selection.fecha !== "" && isPetBookingDate(selection.fecha);
  return queryOptions({
    ...readingPolicy,
    queryKey: queryKeys.petBooking.availability(context.slug, context.sessionScope,
      selection?.mascotaId ?? null, selection?.servicioId ?? null, selection?.extraIds ?? [], selection?.fecha ?? ""),
    enabled,
    queryFn: async ({ signal }) => {
      if (!enabled || !selection) throw new PublicPetHttpError(0);
      const result = await publicPetBookingService.getDisponibilidad(auth, selection, { signal });
      if (result.fecha !== selection.fecha) throw publicPetProtocolError(200);
      return result;
    },
  });
}

export interface PetBookingSubmission {
  input: PetCreateBookingInput;
  snapshot: PetBookingSuccessBase;
}

export function petBookingCreationMutation(context: ScopedPetBookingContext): MutationObserverOptions<PetCreatedBooking, Error, PetBookingSubmission> {
  const auth = { slug: context.slug, token: context.token };
  return {
    mutationKey: queryKeys.petBooking.creation(context.slug, context.sessionScope),
    retry: false,
    gcTime: 0,
    mutationFn: command => publicPetBookingService.crearTurno(auth, command.input),
  };
}

/** Cancellation/removal is synchronous; the returned promise only waits for cancellation settlement. */
export function removePetBookingQueries(client: QueryClient, scope: PetBookingScope): Promise<void> {
  const filter = { queryKey: queryKeys.petBooking.scope(scope.slug, scope.sessionScope) };
  const cancelled = client.cancelQueries(filter, { silent: true });
  client.removeQueries(filter);
  return cancelled;
}

export function petBookingErrorKind(error: unknown) {
  if (!(error instanceof PublicPetHttpError)) return "other";
  if (error.status === 401) return "session-invalid";
  if (error.status === 409 && error.code === "PET_BOOKING_UNAVAILABLE") return "booking-unavailable";
  if (error.status === 409 && error.code === "PET_SLOT_UNAVAILABLE") return "slot-conflict";
  if (error.status === 404 && error.code === "PET_MASCOTA_UNAVAILABLE") return "pet-unavailable";
  if (error.status === 404 && error.code === "PET_SERVICE_UNAVAILABLE") return "service-unavailable";
  if (error.status === 404 && error.code === "PET_EXTRA_UNAVAILABLE") return "extra-unavailable";
  return "other";
}
