import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPetMascotaFormController } from "../state/petMascotaFormController.ts";
import type { usePetManagement } from "./usePetManagement.ts";
import { confirmPetManagementDiscard } from "../components/petManagementConfirm.ts";

export function usePetMascotaForm(localId: string, management: ReturnType<typeof usePetManagement>) {
  const client = useQueryClient();
  const [controller] = useState(() => createPetMascotaFormController(client, {
    localId,
    onSelect: management.selectMascota,
    onUnavailable: management.confirmDetailNotFound,
    confirmDiscard: confirmPetManagementDiscard,
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.connect();
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    controller.syncSelection(management.selectedMascotaId, management.detail);
  }, [controller, management.selectedMascotaId, management.detail]);
  useEffect(() => {
    if (state.focusDetail > 0) document.getElementById("pet-management-detail-title")?.focus();
  }, [state.focusDetail]);
  return { controller, state };
}
