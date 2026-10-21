export interface PetBloqueo {
  id: number;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  motivo: string | null;
  es_dia_completo: 0 | 1;
}

export interface PetBloqueoDraft {
  fecha: string;
  esDiaCompleto: boolean;
  horaInicio: string;
  horaFin: string;
  motivo: string;
}

export interface PetBloqueoWrite {
  fecha?: string;
  esDiaCompleto?: boolean;
  horaInicio?: string | null;
  horaFin?: string | null;
  motivo?: string | null;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function petBloqueoFechaValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizePetBloqueoTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export function validatePetBloqueoDraft(draft: PetBloqueoDraft): Partial<Record<keyof PetBloqueoDraft, string>> {
  const errors: Partial<Record<keyof PetBloqueoDraft, string>> = {};
  if (!petBloqueoFechaValida(draft.fecha)) errors.fecha = "Ingresá una fecha calendario válida.";
  if (draft.motivo.trim().length > 255) errors.motivo = "El motivo admite hasta 255 caracteres.";
  if (!draft.esDiaCompleto) {
    if (!TIME_PATTERN.test(draft.horaInicio)) errors.horaInicio = "Ingresá una hora de inicio válida.";
    if (!TIME_PATTERN.test(draft.horaFin)) errors.horaFin = "Ingresá una hora de fin válida.";
    if (TIME_PATTERN.test(draft.horaInicio) && TIME_PATTERN.test(draft.horaFin) && draft.horaInicio >= draft.horaFin) {
      errors.horaFin = "La hora de inicio debe ser anterior a la hora de fin; no se permite cruzar medianoche.";
    }
  }
  return errors;
}

export function petBloqueoPayload(draft: PetBloqueoDraft): PetBloqueoWrite {
  const motivo = draft.motivo.trim() || null;
  return draft.esDiaCompleto
    ? { fecha: draft.fecha, esDiaCompleto: true, motivo }
    : { fecha: draft.fecha, esDiaCompleto: false, horaInicio: draft.horaInicio, horaFin: draft.horaFin, motivo };
}

export function petBloqueoPatch(draft: PetBloqueoDraft): PetBloqueoWrite {
  // Send a complete final state: switching kinds must also clear/set both times.
  return petBloqueoPayload(draft);
}

export function petBloqueoDraft(record: PetBloqueo): PetBloqueoDraft {
  return {
    fecha: record.fecha,
    esDiaCompleto: record.es_dia_completo === 1,
    horaInicio: normalizePetBloqueoTime(record.hora_inicio),
    horaFin: normalizePetBloqueoTime(record.hora_fin),
    motivo: record.motivo ?? "",
  };
}

export function petBloqueoPayloadMatches(record: PetBloqueo, expected: PetBloqueoWrite): boolean {
  const current = petBloqueoDraft(record);
  return (expected.fecha === undefined || current.fecha === expected.fecha)
    && (expected.esDiaCompleto === undefined || current.esDiaCompleto === expected.esDiaCompleto)
    && (expected.horaInicio === undefined || current.horaInicio === (expected.horaInicio?.slice(0, 5) ?? ""))
    && (expected.horaFin === undefined || current.horaFin === (expected.horaFin?.slice(0, 5) ?? ""))
    && (expected.motivo === undefined || current.motivo === (expected.motivo ?? ""));
}
