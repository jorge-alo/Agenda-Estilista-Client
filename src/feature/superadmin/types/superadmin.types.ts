import type { BusinessType } from "../../../shared/types/businessType";

export interface Local {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  activo: boolean;
  created_at: string;
  business_type: BusinessType;
}

export interface CrearLocalDTO {
  nombreLocal: string;
  email: string;
  password: string;
  telefono?: string;
  business_type: BusinessType;
}
