export interface Turno {
  id: number;
  fecha: string;
  hora: string;
  hora_fin: string;

  cliente_nombre: string;
  cliente_telefono: string;

  estilista_nombre: string;
  estilista_id: number;

  servicio_nombre: string;
  servicio_id: number;

  estado: "activo" | "cancelado" | "completado";
}