export interface Servicio {
  id: number;
  nombre: string;
  duracion: number;
  precio: number;
  activo: boolean;
}

export interface CrearServicioDTO {
  nombre: string;
  duracion: number;
  precio: number;
}

export interface AsignarServicioDTO {
  estilista_id: number;
  servicio_id: number;
}