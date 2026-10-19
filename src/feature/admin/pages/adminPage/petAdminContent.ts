import type { AdminTab } from "./types/adminPage.types.ts";

export type PetAdminContentKind =
  | "agenda"
  | "reservar"
  | "whatsapp"
  | "placeholder"
  | "none";

const PLACEHOLDER_TABS = new Set<AdminTab>([
  "solicitudes",
  "mascotas",
  "servicios",
  "extras",
  "horarios",
  "bloqueos",
  "configuracion",
]);

export function getPetAdminContentKind(tab: AdminTab): PetAdminContentKind {
  if (tab === "agenda") return "agenda";
  if (tab === "reservar") return "reservar";
  if (tab === "whatsapp") return "whatsapp";
  if (PLACEHOLDER_TABS.has(tab)) return "placeholder";
  return "none";
}
