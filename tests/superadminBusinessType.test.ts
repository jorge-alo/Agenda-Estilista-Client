import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESS_TYPE } from "../src/shared/types/businessType.ts";
import { BUSINESS_TYPE_LABELS, filterLocalesByBusinessType } from "../src/shared/types/businessTypeLabels.ts";

const locales = [
  { id: 1, business_type: BUSINESS_TYPE.BEAUTY },
  { id: 2, business_type: BUSINESS_TYPE.PET_GROOMING },
  { id: 3, business_type: BUSINESS_TYPE.BEAUTY },
];

test("labels de negocio muestran nombres amigables", () => {
  assert.equal(BUSINESS_TYPE_LABELS[BUSINESS_TYPE.BEAUTY], "Peluquería / Estética");
  assert.equal(BUSINESS_TYPE_LABELS[BUSINESS_TYPE.PET_GROOMING], "Peluquería Canina");
});

test("el filtro ALL conserva todos los locales y cada tipo limita su resultado", () => {
  assert.deepEqual(filterLocalesByBusinessType(locales, "ALL"), locales);
  assert.deepEqual(filterLocalesByBusinessType(locales, BUSINESS_TYPE.BEAUTY).map(({ id }) => id), [1, 3]);
  assert.deepEqual(filterLocalesByBusinessType(locales, BUSINESS_TYPE.PET_GROOMING).map(({ id }) => id), [2]);
});
