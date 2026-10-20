export const MASCOTA_FLAGS = ["activo", "altaExigencia", "reservaOnlineHabilitada"] as const;
export type MascotaFlag = typeof MASCOTA_FLAGS[number];
export interface MascotaFlagChange {
  flag: MascotaFlag;
  value: boolean;
}
