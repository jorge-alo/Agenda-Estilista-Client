import type { MascotaFlag, MascotaFlagChange } from "../types/petMascotaFlags.types.ts";
import type { PetManagementDetail } from "../types/petManagement.types.ts";

export const MASCOTA_REACTIVATION_BLOCKED = "Deshabilitá primero la reserva online antes de reactivar esta mascota.";
export const MASCOTA_ONLINE_PENDING = "La habilitación online se completará cuando estén aplicadas las validaciones de elegibilidad del flujo PET.";
export const MASCOTA_HIGH_DEMAND_INFO = "Las reservas de alta exigencia requieren una configuración válida de separación/límite para poder calcular disponibilidad.";
export const MASCOTA_FLAG_UNKNOWN = "No pudimos confirmar el cambio. Conservamos el contexto; verificá nuevamente la ficha antes de otra operación de flags.";

export function mascotaFlagBlockedReason(detail: PetManagementDetail, change: MascotaFlagChange): string | null {
  if (change.flag === "reservaOnlineHabilitada" && change.value) return MASCOTA_ONLINE_PENDING;
  if (change.flag === "activo" && change.value && !detail.activo && detail.reservaOnlineHabilitada) return MASCOTA_REACTIVATION_BLOCKED;
  return null;
}

export function mascotaFlagLabels(detail: PetManagementDetail, flag: MascotaFlag) {
  if (flag === "activo") return { title: "Estado", status: detail.activo ? "Activa" : "Inactiva", action: detail.activo ? "Desactivar" : "Reactivar" };
  if (flag === "altaExigencia") return { title: "Exigencia", status: detail.altaExigencia ? "Alta exigencia" : "Normal", action: detail.altaExigencia ? "Marcar normal" : "Marcar alta exigencia" };
  return { title: "Reserva online", status: detail.reservaOnlineHabilitada ? "Habilitada" : "Deshabilitada", action: detail.reservaOnlineHabilitada ? "Deshabilitar reserva online" : "Habilitar reserva online" };
}

export function mascotaFlagConfirmation(change: MascotaFlagChange, detail: PetManagementDetail): string {
  return change.flag === "activo"
    ? `¿Desactivar a ${detail.nombre}? La mascota dejará de aparecer en los flujos que requieren mascotas activas. Sus datos y relaciones se conservarán.`
    : `¿Deshabilitar la reserva online de ${detail.nombre}? La mascota dejará de estar habilitada para la reserva pública. Sus datos y relaciones se conservarán.`;
}

export function mascotaFlagAppliedMessage(change: MascotaFlagChange): string {
  if (change.flag === "activo") return change.value ? "Mascota reactivada." : "Mascota desactivada. Sus datos y relaciones se conservaron.";
  if (change.flag === "altaExigencia") return change.value ? `Se marcó alta exigencia. ${MASCOTA_HIGH_DEMAND_INFO}` : "Se marcó exigencia normal.";
  return "Reserva online deshabilitada.";
}
