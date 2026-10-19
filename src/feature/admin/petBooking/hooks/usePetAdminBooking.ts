import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPetAdminBookingController } from "../booking/petAdminBookingController.ts";
import { petAdminSelectionKey } from "../booking/petAdminBookingState.ts";

export function usePetAdminBooking() {
  const client = useQueryClient();
  // TEMP B.3 -> remove in B.4: the legacy select is an active picker on mount.
  const controller = useMemo(() => createPetAdminBookingController(client, { searchActive: true }), [client]);
  useLayoutEffect(() => () => controller.suspend(), [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  // TEMP B.3: limited suggestions + the authoritative selection, never a full list or a source of validity.
  const selected = snapshot.selectedPetDetail;
  const mascotas = snapshot.searchResults.map(({ id, nombre }) => ({ id, nombre: selected?.id === id ? selected.nombre : nombre }));
  if (selected && !mascotas.some(item => item.id === selected.id)) {
    mascotas.push({ id: selected.id, nombre: selected.nombre });
  }
  return {
    ...snapshot,
    mascotas,
    queries: { ...snapshot.queries, mascotas: snapshot.queries.search },
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
      startNewBooking: () => {
        controller.startNewBooking();
        controller.setSearchActive(true); // TEMP B.3: restore limited suggestions for the unchanged select.
      },
      setSearchTerm: controller.setSearchTerm,
      setSearchActive: controller.setSearchActive,
      clearSearch: controller.clearSearch,
      refetchSearch: controller.refetchSearch,
      refetchMascotas: controller.refetchSearch,
      refetchDetail: controller.refetchDetail,
      refetchServicios: controller.refetchServicios,
      refetchExtras: controller.refetchExtras,
      refetchAvailability: controller.refetchAvailability,
    },
  };
}
