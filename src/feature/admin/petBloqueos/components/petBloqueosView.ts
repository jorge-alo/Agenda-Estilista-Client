import { PetBloqueosApiError } from "../services/petBloqueos.service.ts";

export function petBloqueosErrorMessage(error: unknown): string {
  if (!(error instanceof PetBloqueosApiError)) return "No pudimos confirmar el cambio. Verificá el estado antes de volver a intentar.";
  if (error.status === 0 || error.status >= 500) return "No pudimos comunicarnos con el servicio.";
  if (error.status === 400) return "Revisá la fecha, el tipo y las horas ingresadas.";
  if (error.status === 401) return "Tu sesión expiró. Iniciá sesión nuevamente.";
  if (error.status === 403) return "No tenés permisos para administrar los bloqueos de este local.";
  if (error.status === 404) return "Este bloqueo ya no existe. Actualizamos la lista; verificá los bloqueos.";
  if (error.status === 409) return "Bloqueo solapado: ya existe un bloqueo total o parcial en ese período. Revisá la fecha y el horario.";
  return "Ocurrió un error inesperado.";
}

export const petBloqueoDateLabel = (value: string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; };
