export const BUSINESS_TYPE = {
  BEAUTY: "BEAUTY",
  PET_GROOMING: "PET_GROOMING",
} as const;

export type BusinessType = (typeof BUSINESS_TYPE)[keyof typeof BUSINESS_TYPE];

export function isBusinessType(value: unknown): value is BusinessType {
  return value === BUSINESS_TYPE.BEAUTY || value === BUSINESS_TYPE.PET_GROOMING;
}
