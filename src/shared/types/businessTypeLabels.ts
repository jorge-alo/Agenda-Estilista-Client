import type { BusinessType } from "./businessType";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  BEAUTY: "Peluquería / Estética",
  PET_GROOMING: "Peluquería Canina",
};

export const BUSINESS_TYPE_OPTIONS = [
  { value: "BEAUTY", label: BUSINESS_TYPE_LABELS.BEAUTY },
  { value: "PET_GROOMING", label: BUSINESS_TYPE_LABELS.PET_GROOMING },
] as const;

export type BusinessTypeFilter = BusinessType | "ALL";

export function filterLocalesByBusinessType<T extends { business_type: BusinessType }>(
  locales: T[],
  filter: BusinessTypeFilter,
): T[] {
  return filter === "ALL" ? locales : locales.filter((local) => local.business_type === filter);
}
