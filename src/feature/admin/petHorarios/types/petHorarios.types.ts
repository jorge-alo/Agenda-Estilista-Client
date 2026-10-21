export interface PetHorario {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: 0 | 1;
}

export interface PetHorarioWrite {
  diaSemana?: number;
  horaInicio?: string;
  horaFin?: string;
  activo?: boolean;
}

export const PET_DAYS = [
  { id: 1, label: "Lunes" }, { id: 2, label: "Martes" }, { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" }, { id: 5, label: "Viernes" }, { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
] as const;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/;

export function normalizePetTime(value: string): string {
  return value.length === 8 ? value.slice(0, 5) : value;
}

export function validatePetHorarioDraft(draft: { diaSemana: number | ""; horaInicio: string; horaFin: string }): string | null {
  if (!Number.isInteger(draft.diaSemana) || !PET_DAYS.some(day => day.id === draft.diaSemana)) return "Elegí un día válido.";
  if (!TIME_PATTERN.test(draft.horaInicio) || !TIME_PATTERN.test(draft.horaFin)) return "Ingresá una hora válida para el inicio y el fin.";
  if (draft.horaInicio.slice(0, 5) >= draft.horaFin.slice(0, 5)) return "La hora de inicio debe ser anterior a la hora de fin.";
  return null;
}

export function petHorarioPatch(original: PetHorario, draft: { diaSemana: number | ""; horaInicio: string; horaFin: string }): PetHorarioWrite {
  const patch: PetHorarioWrite = {};
  if (draft.diaSemana !== original.dia_semana) patch.diaSemana = draft.diaSemana as number;
  if (draft.horaInicio !== normalizePetTime(original.hora_inicio)) patch.horaInicio = draft.horaInicio;
  if (draft.horaFin !== normalizePetTime(original.hora_fin)) patch.horaFin = draft.horaFin;
  return patch;
}
