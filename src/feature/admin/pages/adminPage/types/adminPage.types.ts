export type AdminTab =
  | "dashboard"
  | "agenda"
  | "reservar"
  | "clientes"
  | "estilistas"
  | "servicios"
  | "horarios"
  | "bloqueos"
  | "configuracion"
  | "whatsapp";

export interface AdminMeResponse {
  nombreLocal: string;
  localId: number;
}