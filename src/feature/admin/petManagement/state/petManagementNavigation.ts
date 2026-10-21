import type { PetMascotaFormController } from "./petMascotaFormController.ts";
import type { PetResponsablesController } from "./petResponsablesController.ts";
import type { PetMascotaFlagsController } from "./petMascotaFlagsController.ts";
import type { PetMascotaServiciosController } from "./petMascotaServiciosController.ts";
import type { PetMascotaExtrasController } from "./petMascotaExtrasController.ts";

export interface PetManagementNavigationGuard {
  hasPendingChanges: () => boolean;
  canLeave: () => boolean;
}
export type RegisterPetManagementNavigation = (guard: PetManagementNavigationGuard | null) => void;

/** Read live snapshots: navigation must not depend on the last React render. */
export function createPetManagementNavigation(
  data: PetMascotaFormController, responsables: PetResponsablesController,
  flags: PetMascotaFlagsController, servicios: PetMascotaServiciosController, extras: PetMascotaExtrasController,
): PetManagementNavigationGuard {
  const others = () => [responsables.getSnapshot(), flags.getSnapshot(), servicios.getSnapshot(), extras.getSnapshot()];
  const busy = () => data.getSnapshot().submitting || data.getSnapshot().checking || others().some(state => state.busy);
  return {
    hasPendingChanges: () => busy() || data.getSnapshot().dirty || others().some(state => state.dirty),
    canLeave: () => !busy() && data.canLeave(others().some(state => state.dirty)),
  };
}
