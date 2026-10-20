import type { PetManagementDetail } from "../types/petManagement.types.ts";

export const MASCOTA_DATA_FIELDS = [
  "nombre", "raza", "fecha_nacimiento", "sexo", "tamano", "tipo_pelo", "observaciones",
] as const;
export type MascotaDataField = (typeof MASCOTA_DATA_FIELDS)[number];
export type MascotaFormDraft = Record<MascotaDataField, string>;
export type MascotaFormErrors = Partial<Record<MascotaDataField, string>>;
export type MascotaData = { nombre: string } & Record<Exclude<MascotaDataField, "nombre">, string | null>;
export type MascotaDataPatch = Partial<MascotaData>;

export const MASCOTA_TEXT_LIMITS = { nombre: 255, raza: 100, sexo: 20, tamano: 20, tipo_pelo: 50 } as const;

export function emptyMascotaDraft(): MascotaFormDraft {
  return { nombre: "", raza: "", fecha_nacimiento: "", sexo: "", tamano: "", tipo_pelo: "", observaciones: "" };
}

/** Calendar string only: no UTC/local-time conversion, age or future-date restriction. */
export function mascotaBirthDateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function detailToMascotaDraft(detail: PetManagementDetail): MascotaFormDraft {
  return {
    nombre: detail.nombre, raza: detail.raza ?? "", fecha_nacimiento: detail.fechaNacimiento ?? "",
    sexo: detail.sexo ?? "", tamano: detail.tamano ?? "", tipo_pelo: detail.tipoPelo ?? "",
    observaciones: detail.observaciones ?? "",
  };
}

export function normalizeMascotaDraft(draft: MascotaFormDraft): MascotaData {
  return {
    nombre: draft.nombre.trim(), raza: draft.raza.trim() || null,
    fecha_nacimiento: draft.fecha_nacimiento.trim() || null, sexo: draft.sexo.trim() || null,
    tamano: draft.tamano.trim() || null, tipo_pelo: draft.tipo_pelo.trim() || null,
    observaciones: draft.observaciones.trim() || null,
  };
}

export function validateMascotaDraft(draft: MascotaFormDraft): MascotaFormErrors {
  const data = normalizeMascotaDraft(draft);
  const errors: MascotaFormErrors = {};
  if (!data.nombre) errors.nombre = "Ingresá el nombre de la mascota.";
  for (const field of Object.keys(MASCOTA_TEXT_LIMITS) as Array<keyof typeof MASCOTA_TEXT_LIMITS>) {
    if ((data[field]?.length ?? 0) > MASCOTA_TEXT_LIMITS[field]) {
      errors[field] = `Usá hasta ${MASCOTA_TEXT_LIMITS[field]} caracteres.`;
    }
  }
  if (data.fecha_nacimiento !== null && !mascotaBirthDateValid(data.fecha_nacimiento)) {
    errors.fecha_nacimiento = "Ingresá una fecha válida en formato AAAA-MM-DD.";
  }
  return errors;
}

export function buildMascotaDataPatch(original: MascotaData, draft: MascotaFormDraft): MascotaDataPatch {
  const normalized = normalizeMascotaDraft(draft);
  return Object.fromEntries(MASCOTA_DATA_FIELDS.flatMap(field =>
    original[field] === normalized[field] ? [] : [[field, normalized[field]]],
  )) as MascotaDataPatch;
}

export function mascotaDraftDirty(original: MascotaData, draft: MascotaFormDraft): boolean {
  return Object.keys(buildMascotaDataPatch(original, draft)).length > 0;
}

/** Project only audited data fields even if an untyped caller supplies flags/tenant/metadata. */
export function mascotaWriteBody(data: MascotaDataPatch): MascotaDataPatch {
  return Object.fromEntries(MASCOTA_DATA_FIELDS.flatMap(field =>
    data[field] === undefined ? [] : [[field, data[field]]],
  )) as MascotaDataPatch;
}
