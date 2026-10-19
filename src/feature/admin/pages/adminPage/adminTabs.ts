import { BUSINESS_TYPE, type BusinessType } from "../../../../shared/types/businessType.ts";
import type { AdminTab } from "./types/adminPage.types.ts";

const BEAUTY_TABS = [
  "dashboard",
  "agenda",
  "reservar",
  "clientes",
  "estilistas",
  "servicios",
  "horarios",
  "bloqueos",
  "configuracion",
  "whatsapp",
] as const satisfies readonly AdminTab[];

const PET_TABS = [
  "agenda",
  "reservar",
  "solicitudes",
  "mascotas",
  "servicios",
  "extras",
  "horarios",
  "bloqueos",
  "configuracion",
  "whatsapp",
] as const satisfies readonly AdminTab[];

const ADMIN_TABS_BY_BUSINESS: Record<BusinessType, readonly AdminTab[]> = {
  [BUSINESS_TYPE.BEAUTY]: BEAUTY_TABS,
  [BUSINESS_TYPE.PET_GROOMING]: PET_TABS,
};

const INITIAL_TABS_BY_BUSINESS: Record<BusinessType, AdminTab> = {
  [BUSINESS_TYPE.BEAUTY]: "agenda",
  [BUSINESS_TYPE.PET_GROOMING]: "agenda",
};

const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  reservar: "Reservar",
  clientes: "Clientes",
  estilistas: "Estilistas",
  solicitudes: "Solicitudes",
  mascotas: "Mascotas",
  servicios: "Servicios",
  extras: "Extras",
  horarios: "Horarios",
  bloqueos: "Bloqueos",
  configuracion: "Configuración",
  whatsapp: "WhatsApp",
};

export function getAdminTabs(businessType: BusinessType): readonly AdminTab[] {
  return ADMIN_TABS_BY_BUSINESS[businessType];
}

export function getInitialAdminTab(businessType: BusinessType): AdminTab {
  return INITIAL_TABS_BY_BUSINESS[businessType];
}

export function isAdminTabForBusinessType(
  tab: string,
  businessType: BusinessType,
): tab is AdminTab {
  return getAdminTabs(businessType).includes(tab as AdminTab);
}

export function reconcileAdminTab(
  tab: AdminTab,
  businessType: BusinessType,
): AdminTab {
  return isAdminTabForBusinessType(tab, businessType)
    ? tab
    : getInitialAdminTab(businessType);
}

export function getAdminTabLabel(tab: AdminTab): string {
  return ADMIN_TAB_LABELS[tab];
}
