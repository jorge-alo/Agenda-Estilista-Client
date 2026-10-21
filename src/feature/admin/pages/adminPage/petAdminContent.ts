import { BUSINESS_TYPE, type BusinessType } from "../../../../shared/types/businessType.ts";
import type { AdminTab } from "./types/adminPage.types.ts";

export type PetAdminContentKind =
  | "agenda"
  | "reservar"
  | "mascotas"
  | "servicios"
  | "extras"
  | "horarios"
  | "bloqueos"
  | "configuracion"
  | "whatsapp"
  | "placeholder"
  | "none";

const PLACEHOLDER_TABS = new Set<AdminTab>([
  "solicitudes",
]);

export function getPetAdminContentKind(tab: AdminTab): PetAdminContentKind {
  if (tab === "agenda") return "agenda";
  if (tab === "reservar") return "reservar";
  if (tab === "mascotas") return "mascotas";
  if (tab === "servicios") return "servicios";
  if (tab === "extras") return "extras";
  if (tab === "horarios") return "horarios";
  if (tab === "bloqueos") return "bloqueos";
  if (tab === "configuracion") return "configuracion";
  if (tab === "whatsapp") return "whatsapp";
  if (PLACEHOLDER_TABS.has(tab)) return "placeholder";
  return "none";
}

export function isWidePetAdminContent(businessType: BusinessType, tab: AdminTab): boolean {
  return businessType === BUSINESS_TYPE.PET_GROOMING && tab === "mascotas";
}
