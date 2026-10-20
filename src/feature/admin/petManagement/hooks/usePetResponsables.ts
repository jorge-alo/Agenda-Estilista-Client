import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPetResponsablesController } from "../state/petResponsablesController.ts";
import { confirmPetManagementDiscard } from "../components/petManagementConfirm.ts";
import type { usePetManagement } from "./usePetManagement.ts";

export function usePetResponsables(localId: string, management: ReturnType<typeof usePetManagement>, creating: boolean) {
  const client = useQueryClient();
  const [controller] = useState(() => createPetResponsablesController(client, {
    localId,
    confirmDiscard: confirmPetManagementDiscard,
    confirmRemove: (responsable, mascotaNombre) => window.confirm(
      `¿Quitar a ${responsable.nombre} de ${mascotaNombre}? Solo se quitará la relación con esta mascota. El responsable no se eliminará del sistema.`,
    ),
    onUnavailable: management.confirmDetailNotFound,
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.connect();
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    controller.syncSelection(creating ? null : management.selectedMascotaId, creating ? null : management.detail);
  }, [controller, creating, management.selectedMascotaId, management.detail]);
  useEffect(() => {
    if (state.focusList > 0) document.getElementById("pet-management-responsables-title")?.focus();
  }, [state.focusList]);
  return { controller, state };
}
