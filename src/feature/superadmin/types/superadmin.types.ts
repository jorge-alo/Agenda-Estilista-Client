export interface Local {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  activo: boolean;
  created_at: string;
}

export interface CrearLocalDTO {
  nombreLocal: string;
  email: string;
  password: string;
  telefono?: string;
}