import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PetPublicProfile } from "../session/publicPetSession.service.ts";
import { createPetBookingController } from "../booking/publicPetBookingController.ts";
import type { PetBookingScope, ScopedPetBookingContext } from "../booking/publicPetBookingQueries.ts";

interface UsePetBookingInput extends ScopedPetBookingContext {
  profile: PetPublicProfile;
  onSessionInvalid?: (scope: PetBookingScope) => void;
}

/** F.4 supplies a stable non-secret sessionScope; never derive it from/persist it with the Bearer. */
export function usePetBooking({ slug, token, sessionScope, profile, onSessionInvalid }: UsePetBookingInput) {
  const client = useQueryClient();
  const controller = useMemo(() => createPetBookingController(client, { slug, token, sessionScope }),
    [client, slug, token, sessionScope]);
  useLayoutEffect(() => {
    controller.setOnSessionInvalid(onSessionInvalid);
    return () => { controller.setOnSessionInvalid(undefined); };
  }, [controller, onSessionInvalid]);
  useLayoutEffect(() => () => { controller.suspend(); }, [controller]);
  useLayoutEffect(() => { controller.setProfile(profile); }, [controller, profile]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return {
    ...snapshot,
    draft: snapshot.state.draft,
    createdBooking: snapshot.state.success,
    bookingUnavailable: snapshot.state.bookingUnavailable,
    actions: {
      setMascota: controller.setMascota,
      setServicio: controller.setServicio,
      toggleExtra: controller.toggleExtra,
      setFecha: controller.setFecha,
      setSlot: controller.setSlot,
      confirmar: controller.confirmar,
      retryBooking: controller.retryBooking,
      startNewBooking: controller.startNewBooking,
      refetchOptions: controller.refetchOptions,
      refetchAvailability: controller.refetchAvailability,
      reconcileOptions: controller.reconcileOptions,
    },
  };
}
