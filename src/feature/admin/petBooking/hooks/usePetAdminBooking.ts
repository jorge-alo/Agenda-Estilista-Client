import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPetAdminBookingController } from "../booking/petAdminBookingController.ts";
import { petAdminSelectionKey } from "../booking/petAdminBookingState.ts";

export function usePetAdminBooking() {
  const client = useQueryClient();
  const controller = useMemo(() => createPetAdminBookingController(client), [client]);
  useLayoutEffect(() => () => controller.suspend(), [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return {
    ...snapshot,
    draft: snapshot.state.draft,
    createdBooking: snapshot.state.success,
    actions: {
      setMascota: controller.setMascota,
      setCliente: controller.setCliente,
      setServicio: controller.setServicio,
      toggleExtra: controller.toggleExtra,
      setFecha: controller.setFecha,
      setSlot: (slot: { horaInicio: string; horaFin: string }) => controller.setSlot({
        ...slot,
        selectionKey: petAdminSelectionKey(controller.getSnapshot().state.draft),
      }),
      confirmar: controller.confirmar,
      startNewBooking: controller.startNewBooking,
      refetchMascotas: controller.refetchMascotas,
      refetchDetail: controller.refetchDetail,
      refetchServicios: controller.refetchServicios,
      refetchExtras: controller.refetchExtras,
      refetchAvailability: controller.refetchAvailability,
    },
  };
}
