export const PET_SOLICITUD_ESTADOS = ["NUEVA", "CONTACTADA", "CONVERTIDA", "DESCARTADA"] as const;
export type PetSolicitudEstado = typeof PET_SOLICITUD_ESTADOS[number];
export type PetSolicitudFiltro = PetSolicitudEstado | null;

export interface PetSolicitud {
  id: number;
  responsable: { nombre: string; telefono: string; telefonoSecundario: string | null };
  mascota: { nombre: string; raza: string | null; fechaNacimiento: string | null; tamano: string | null; sexo: string | null };
  motivoContacto: string | null;
  estado: PetSolicitudEstado;
  createdAt: string;
  updatedAt: string;
}

export interface PetSolicitudConversionInput {
  responsable: { nombre: string; telefono: string };
  mascota: { nombre: string; raza: string | null; fechaNacimiento: string | null; tamano: string | null; sexo: string | null; tipoPelo: string | null; observaciones: string | null };
}

export interface PetSolicitudConversionResult {
  solicitudId: number;
  estado: "CONVERTIDA";
  cliente: { id: number; reutilizado: boolean };
  mascota: { id: number };
}

export function parsePetSolicitudes(value: unknown): PetSolicitud[] | null {
  if (!Array.isArray(value)) return null;
  const result: PetSolicitud[] = [];
  for (const item of value) {
    if (!record(item) || !intId(item.id) || !record(item.responsable) || !record(item.mascota)
      || typeof item.responsable.nombre !== "string" || typeof item.responsable.telefono !== "string"
      || !nullableText(item.responsable.telefonoSecundario) || typeof item.mascota.nombre !== "string"
      || !nullableText(item.mascota.raza) || !nullableText(item.mascota.fechaNacimiento)
      || !nullableText(item.mascota.tamano) || !nullableText(item.mascota.sexo)
      || !nullableText(item.motivoContacto) || !PET_SOLICITUD_ESTADOS.includes(item.estado as PetSolicitudEstado)
      || typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") return null;
    result.push({ id: item.id, responsable: { nombre: item.responsable.nombre, telefono: item.responsable.telefono, telefonoSecundario: item.responsable.telefonoSecundario }, mascota: { nombre: item.mascota.nombre, raza: item.mascota.raza, fechaNacimiento: item.mascota.fechaNacimiento, tamano: item.mascota.tamano, sexo: item.mascota.sexo }, motivoContacto: item.motivoContacto, estado: item.estado as PetSolicitudEstado, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  return result;
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function intId(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }

export function parsePetSolicitudConversion(value: unknown): PetSolicitudConversionResult | null {
  if (!record(value) || !intId(value.solicitudId) || value.estado !== "CONVERTIDA" || !record(value.cliente) || !intId(value.cliente.id) || typeof value.cliente.reutilizado !== "boolean" || !record(value.mascota) || !intId(value.mascota.id)) return null;
  return { solicitudId: value.solicitudId, estado: "CONVERTIDA", cliente: { id: value.cliente.id, reutilizado: value.cliente.reutilizado }, mascota: { id: value.mascota.id } };
}

export function conversionDraft(solicitud: PetSolicitud) {
  return { responsable: { nombre: solicitud.responsable.nombre, telefono: solicitud.responsable.telefono }, mascota: { nombre: solicitud.mascota.nombre, raza: solicitud.mascota.raza, fechaNacimiento: solicitud.mascota.fechaNacimiento, tamano: solicitud.mascota.tamano, sexo: solicitud.mascota.sexo, tipoPelo: "", observaciones: "" } };
}

export function petSolicitudActions(estado: PetSolicitudEstado) {
  return { contactar: estado === "NUEVA", descartar: estado === "NUEVA" || estado === "CONTACTADA", convertir: estado === "NUEVA" || estado === "CONTACTADA" };
}
