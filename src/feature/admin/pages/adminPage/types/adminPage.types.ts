export type AdminTab =
  | "dashboard"
  | "agenda"
  | "reservar"
  | "clientes"
  | "estilistas"
  | "solicitudes"
  | "mascotas"
  | "servicios"
  | "extras"
  | "horarios"
  | "bloqueos"
  | "configuracion"
  | "whatsapp";

import type { BusinessType } from "../../../../../shared/types/businessType";
export { BUSINESS_TYPE, isBusinessType } from "../../../../../shared/types/businessType";
export type { BusinessType } from "../../../../../shared/types/businessType";

export interface AdminMeResponse {
  status: string;
  nombreLocal: string | null;
  telefono: string | null;
  localId: number | null;
  businessType: BusinessType | null;
}
