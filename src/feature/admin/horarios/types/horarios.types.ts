export interface Horario {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface CrearHorarioDTO {
  estilista_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}