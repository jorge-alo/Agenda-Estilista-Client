import type { PetAdminBookingIssue } from "./petAdminBookingController.ts";

export function petAdminBookingIssueMessage(issue: PetAdminBookingIssue | null): string | null {
  if (!issue) return null;
  switch (issue.kind) {
    case "slot-conflict": return "Ese horario acaba de dejar de estar disponible.";
    case "mascota-stale": return "La información de la mascota cambió. Revisá la selección.";
    case "responsable-stale": return "El responsable seleccionado ya no está asociado a esta mascota. Revisá la selección.";
    case "servicio-stale": return "La configuración del servicio cambió. Revisá la selección.";
    case "extra-stale": return "La configuración de algunos extras cambió. Revisá la selección.";
    case "settings-required": return "Esta mascota está marcada como de alta exigencia. Antes de consultar disponibilidad, configurá una regla MIN_GAP o MAX_PER_DAY desde Configuración PET.";
    case "forbidden": return "No tenés permisos para realizar esta operación.";
    case "creation-unknown": return "No pudimos confirmar el resultado de la reserva. Revisá la agenda antes de intentarlo nuevamente.";
    case "invalid": return "No se pudo validar la selección. Revisá los datos e intentá nuevamente.";
    case "unauthorized": return "La sesión finalizó. Iniciá sesión nuevamente.";
    case "read-error": return null;
  }
}

export function petAdminDateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function petAdminSlotLabel(horaInicio: string, horaFin: string): string {
  return `${horaInicio} – ${horaFin}`;
}
