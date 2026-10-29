export type PetHighDemandRule = "MIN_GAP" | "MAX_PER_DAY";

export interface PetSettings {
  configured: boolean;
  highDemandRule: PetHighDemandRule | null;
  highDemandGapMinutes: number | null;
  highDemandMaxPerDay: number | null;
  petConcurrentCapacity: number;
}

export interface PetCapacityWrite { petConcurrentCapacity: number }

export function parsePetCapacityValue(value: unknown): PetCapacityWrite | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capacity = (value as Record<string, unknown>).petConcurrentCapacity;
  return typeof capacity === "number" && Number.isInteger(capacity) && capacity >= 1 && capacity <= 10
    ? { petConcurrentCapacity: capacity } : null;
}

export function validatePetCapacityDraft(draft: string): string | null {
  return /^(?:[1-9]|10)$/.test(draft) ? null : "Ingresá un número entero entre 1 y 10.";
}

export function petCapacityPayload(draft: string): PetCapacityWrite | null {
  return validatePetCapacityDraft(draft) ? null : { petConcurrentCapacity: Number(draft) };
}

export type PetSettingsWrite = Pick<PetSettings, "highDemandRule" | "highDemandGapMinutes" | "highDemandMaxPerDay"> & {
  highDemandRule: PetHighDemandRule;
};

export interface PetSettingsDraft {
  rule: PetHighDemandRule | null;
  value: string;
}

export function parsePetSettingsValue(value: unknown): PetSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  const capacity = parsePetCapacityValue(settings);
  if (!capacity) return null;
  if (typeof settings.configured !== "boolean") return null;
  if (!settings.configured) {
    return settings.highDemandRule === null && settings.highDemandGapMinutes === null && settings.highDemandMaxPerDay === null
      ? { configured: false, highDemandRule: null, highDemandGapMinutes: null, highDemandMaxPerDay: null, ...capacity }
      : null;
  }
  const rule = settings.highDemandRule;
  const gap = settings.highDemandGapMinutes;
  const max = settings.highDemandMaxPerDay;
  if (rule === "MIN_GAP" && Number.isInteger(gap) && Number(gap) >= 1 && Number(gap) <= 2147483647 && max === null) {
    return { configured: true, highDemandRule: rule, highDemandGapMinutes: gap as number, highDemandMaxPerDay: null, ...capacity };
  }
  if (rule === "MAX_PER_DAY" && max === 1 && gap === null) {
    return { configured: true, highDemandRule: rule, highDemandGapMinutes: null, highDemandMaxPerDay: max as number, ...capacity };
  }
  return null;
}

export function petSettingsDraft(settings: PetSettings): PetSettingsDraft {
  return {
    rule: settings.highDemandRule,
    value: settings.highDemandRule === "MIN_GAP"
      ? String(settings.highDemandGapMinutes)
      : settings.highDemandRule === "MAX_PER_DAY" ? "1" : "",
  };
}

export function petSettingsDraftDirty(settings: PetSettings, draft: PetSettingsDraft): boolean {
  const payload = petSettingsPayload(draft);
  return payload === null
    ? draft.rule !== settings.highDemandRule || draft.value !== (settings.configured
      ? String(settings.highDemandRule === "MIN_GAP" ? settings.highDemandGapMinutes : settings.highDemandMaxPerDay) : "")
    : !petSettingsMatchesWrite(settings, payload);
}

export function validatePetSettingsDraft(draft: PetSettingsDraft): string | null {
  if (!draft.rule) return "Elegí una regla antes de guardar.";
  if (draft.rule === "MAX_PER_DAY") return draft.value === "1" ? null : "Esta regla permite exactamente un turno por día.";
  if (!/^\d+$/.test(draft.value) || !Number.isSafeInteger(Number(draft.value)) || Number(draft.value) < 1 || Number(draft.value) > 2147483647) {
    return "Ingresá un número entero positivo válido.";
  }
  return null;
}

export function petSettingsPayload(draft: PetSettingsDraft): PetSettingsWrite | null {
  if (validatePetSettingsDraft(draft)) return null;
  const value = Number(draft.value);
  return draft.rule === "MIN_GAP"
    ? { highDemandRule: "MIN_GAP", highDemandGapMinutes: value, highDemandMaxPerDay: null }
    : { highDemandRule: "MAX_PER_DAY", highDemandGapMinutes: null, highDemandMaxPerDay: 1 };
}

export function petSettingsMatchesWrite(settings: PetSettings, write: PetSettingsWrite): boolean {
  return settings.configured && settings.highDemandRule === write.highDemandRule
    && settings.highDemandGapMinutes === write.highDemandGapMinutes
    && settings.highDemandMaxPerDay === write.highDemandMaxPerDay;
}
