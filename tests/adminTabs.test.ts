import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESS_TYPE } from "../src/shared/types/businessType.ts";
import {
  getAdminTabLabel,
  getAdminTabs,
  getInitialAdminTab,
  isAdminTabForBusinessType,
  reconcileAdminTab,
} from "../src/feature/admin/pages/adminPage/adminTabs.ts";
import { getPetAdminContentKind, isWidePetAdminContent } from "../src/feature/admin/pages/adminPage/petAdminContent.ts";

test("BEAUTY conserva la navegación actual", () => {
  assert.deepEqual(getAdminTabs(BUSINESS_TYPE.BEAUTY), [
    "dashboard",
    "agenda",
    "reservar",
    "clientes",
    "estilistas",
    "servicios",
    "horarios",
    "bloqueos",
    "configuracion",
    "whatsapp",
  ]);
});

test("PET usa su navegación explícita", () => {
  assert.deepEqual(getAdminTabs(BUSINESS_TYPE.PET_GROOMING), [
    "agenda",
    "reservar",
    "solicitudes",
    "mascotas",
    "servicios",
    "extras",
    "horarios",
    "bloqueos",
    "configuracion",
    "whatsapp",
  ]);
});

test("PET no incluye tabs exclusivas de BEAUTY", () => {
  const tabs = getAdminTabs(BUSINESS_TYPE.PET_GROOMING);

  assert.equal(tabs.includes("dashboard"), false);
  assert.equal(tabs.includes("clientes"), false);
  assert.equal(tabs.includes("estilistas"), false);
});

test("cada vertical conserva su tab inicial", () => {
  assert.equal(getInitialAdminTab(BUSINESS_TYPE.BEAUTY), "agenda");
  assert.equal(getInitialAdminTab(BUSINESS_TYPE.PET_GROOMING), "agenda");
});

test("reconcilia una tab inexistente en la nueva vertical", () => {
  assert.equal(reconcileAdminTab("dashboard", BUSINESS_TYPE.PET_GROOMING), "agenda");
  assert.equal(reconcileAdminTab("mascotas", BUSINESS_TYPE.BEAUTY), "agenda");
  assert.equal(reconcileAdminTab("agenda", BUSINESS_TYPE.PET_GROOMING), "agenda");
  assert.equal(reconcileAdminTab("servicios", BUSINESS_TYPE.BEAUTY), "servicios");
});

test("valida pertenencia por vertical", () => {
  assert.equal(isAdminTabForBusinessType("mascotas", BUSINESS_TYPE.PET_GROOMING), true);
  assert.equal(isAdminTabForBusinessType("mascotas", BUSINESS_TYPE.BEAUTY), false);
  assert.equal(isAdminTabForBusinessType("clientes", BUSINESS_TYPE.PET_GROOMING), false);
});

test("las labels visibles conservan la copy del panel", () => {
  assert.equal(getAdminTabLabel("configuracion"), "Configuración");
  assert.equal(getAdminTabLabel("whatsapp"), "WhatsApp");
  assert.equal(getAdminTabLabel("mascotas"), "Mascotas");
});

test("PET conecta solo contenido PET existente y placeholders explícitos", () => {
  assert.equal(getPetAdminContentKind("agenda"), "agenda");
  assert.equal(getPetAdminContentKind("reservar"), "reservar");
  assert.equal(getPetAdminContentKind("mascotas"), "mascotas");
  assert.equal(getPetAdminContentKind("servicios"), "servicios");
  assert.equal(getPetAdminContentKind("whatsapp"), "whatsapp");

  for (const tab of [
    "solicitudes",
    "extras",
    "horarios",
    "bloqueos",
    "configuracion",
  ] as const) {
    assert.equal(getPetAdminContentKind(tab), "placeholder");
  }
});

test("solo Mascotas PET usa el ancho amplio del panel", () => {
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.PET_GROOMING, "mascotas"), true);
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.PET_GROOMING, "agenda"), false);
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.BEAUTY, "mascotas"), false);
});

test("PET nunca resuelve tabs exclusivas de BEAUTY a contenido", () => {
  assert.equal(getPetAdminContentKind("dashboard"), "none");
  assert.equal(getPetAdminContentKind("clientes"), "none");
  assert.equal(getPetAdminContentKind("estilistas"), "none");
});
