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
