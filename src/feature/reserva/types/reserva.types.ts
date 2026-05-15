export interface Estilista {
  id: number;
  nombre: string;
}

export interface Servicio {
  id: number;
  nombre: string;
  duracion: number;
  precio: number;
}

export interface InfoLocal {
  nombreLocal: string;
  descripcion: string;
  direccion: string;
  telefono: string;
  horario_apertura: string;
  horario_cierre: string;
}

export interface ReservaDTO {
  slug: string;
  fecha: string;
  hora: string;
  estilista_id: number;
  servicio_id: number | null;
  cliente_nombre: string;
  cliente_telefono: string;
}