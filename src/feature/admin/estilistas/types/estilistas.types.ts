export interface Estilista {
  id: number;
  nombre: string;
}

export interface CrearEstilistaDTO {
  nombre: string;
}

export interface ActualizarEstilistaDTO {
  id: number;
  nombre: string;
}