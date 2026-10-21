import { PET_DAYS, normalizePetTime } from "../types/petHorarios.types.ts";
import type { PetHorario, PetHorarioWrite } from "../types/petHorarios.types.ts";

export type PetHorarioVerification =
  | { kind: "create"; expected: { diaSemana: number | ""; horaInicio: string; horaFin: string } }
  | { kind: "update"; id: number; expected: PetHorarioWrite }
  | { kind: "delete"; id: number };

export function petHorarioChangeApplied(records: readonly PetHorario[], pending: PetHorarioVerification): boolean {
  if (pending.kind === "delete") return !records.some(item => item.id === pending.id);
  if (pending.kind === "create") return records.some(item => item.dia_semana === pending.expected.diaSemana
    && normalizePetTime(item.hora_inicio) === pending.expected.horaInicio
    && normalizePetTime(item.hora_fin) === pending.expected.horaFin && item.activo === 1);
  return records.some(item => item.id === pending.id && Object.entries(pending.expected).every(([field, value]) =>
    field === "diaSemana" ? item.dia_semana === value : field === "horaInicio" ? normalizePetTime(item.hora_inicio) === value
      : field === "horaFin" ? normalizePetTime(item.hora_fin) === value : item.activo === (value ? 1 : 0)));
}

export function petHorarioDayLabel(day: number): string { return PET_DAYS.find(item => item.id === day)?.label ?? "Día inválido"; }
export function petHorarioTimeLabel(start: string, end: string): string { return `${normalizePetTime(start)} – ${normalizePetTime(end)}`; }
export function petHorarioDayState(records: readonly { activo: number }[]): "open" | "closed" {
  return records.some(record => record.activo === 1) ? "open" : "closed";
}

export function petHorariosErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !("status" in error)) return "Ocurrió un error inesperado. Intentá nuevamente.";
  const status = (error as Error & { status: number }).status;
  if (status === 0 || status >= 500) return "No pudimos comunicarnos con el servicio. Intentá nuevamente.";
  if (status === 400) return "Revisá el día y las horas ingresadas.";
  if (status === 401) return "Tu sesión expiró. Iniciá sesión nuevamente.";
  if (status === 403) return "No tenés permisos para administrar los horarios de este local.";
  if (status === 404) return "Este tramo ya no existe. Actualizamos la lista; verificá los horarios.";
  if (status === 409) return "No se pudo guardar: el tramo se solapa con otro horario activo o ya existe uno idéntico, incluso si está inactivo. Revisá o reactivá el tramo existente.";
  return "Ocurrió un error inesperado. Intentá nuevamente.";
}
