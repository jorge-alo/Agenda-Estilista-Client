export type EstadoTurnoPet = "activo" | "cancelado" | "completado" | "pendiente_pago" | null;

export interface TurnoPet {
  id: number;
  fecha: string;
  hora: string;
  horaFin: string | null;
  estado: EstadoTurnoPet;
  mascota: {
    id: number;
    nombre: string;
    altaExigenciaSnapshot: boolean | null;
  };
  responsable: {
    id: number | null;
    nombre: string;
    telefono: string;
  };
  servicio: {
    id: number | null;
    nombre: string;
    duracionMinutos: number;
  };
  extras: Array<{
    id: number | null;
    nombre: string;
    duracionMinutos: number;
  }>;
}

export type ConsultaTurnosPet =
  | { fecha: string }
  | { desde: string; hasta: string };

export interface PetRescheduleAvailability {
  fecha: string;
  duracionMinutos: number;
  slots: Array<{
    horaInicio: string;
    horaFin: string;
  }>;
}

export function isValidPetDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
