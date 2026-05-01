export interface CrearBloqueoDTO {
  estilista_id: number;

  fecha: string;

  hora_inicio: string;

  hora_fin: string;

  motivo?: string;
}

export interface Bloqueo {
  id: number;

  estilista_nombre: string;

  fecha: string;

  hora_inicio: string;

  hora_fin: string;

  motivo: string;
}