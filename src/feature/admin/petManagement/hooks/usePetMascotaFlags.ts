import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { confirmPetManagementAction } from "../components/petManagementConfirm.ts";
import { mascotaFlagConfirmation } from "../components/petMascotaFlagsView.ts";
import { createPetMascotaFlagsController } from "../state/petMascotaFlagsController.ts";
import type { usePetManagement } from "./usePetManagement.ts";

export function usePetMascotaFlags(localId: string, management: ReturnType<typeof usePetManagement>, creating: boolean, canChange: () => boolean) {
  const client = useQueryClient();
  const [controller] = useState(() => createPetMascotaFlagsController(client, {
    localId,
    confirmChange: (change, detail) => confirmPetManagementAction(mascotaFlagConfirmation(change, detail)),
    onUnavailable: management.confirmDetailNotFound,
    canChange,
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.connect();
    return () => controller.disconnect();
  }, [controller]);
  useEffect(() => {
    controller.syncSelection(creating ? null : management.selectedMascotaId, creating ? null : management.detail);
  }, [controller, creating, management.selectedMascotaId, management.detail]);
  return { controller, state };
}
