import { BUSINESS_TYPE, type BusinessType } from "../../../../shared/types/businessType.ts";

export type AdminBookingVariant = "BEAUTY" | "PET";

export function getAdminBookingVariant(businessType: BusinessType): AdminBookingVariant {
  return businessType === BUSINESS_TYPE.PET_GROOMING ? "PET" : "BEAUTY";
}
