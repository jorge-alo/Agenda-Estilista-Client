import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
    try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier); }
  }
  return nextResolve(specifier);
}, load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "" };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  }).outputText };
  return nextLoad(url, context);
} });

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const { petSettingsService, PetSettingsApiError } = await import("../src/feature/admin/petSettings/services/petSettings.service.ts");
const { acceptPetCapacity, petSettingsQuery, petSettingsMutationPolicy, acquirePetSettingsWriteLock, createPetSettingsNavigationGuard, invalidatePetSettingsDependencies } = await import("../src/feature/admin/petSettings/queries/petSettingsQueries.ts");
const { parsePetCapacityValue, petCapacityPayload, parsePetSettingsValue, petSettingsDraft, petSettingsDraftDirty, petSettingsPayload, petSettingsMatchesWrite, validatePetCapacityDraft, validatePetSettingsDraft } = await import("../src/feature/admin/petSettings/types/petSettings.types.ts");
const { PetSettingsAdmin } = await import("../src/feature/admin/petSettings/components/PetSettingsAdmin.tsx");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const { getPetAdminContentKind } = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");

const unconfigured = { configured: false, highDemandRule: null, highDemandGapMinutes: null, highDemandMaxPerDay: null, petConcurrentCapacity: 1 } as const;
const minGap = { configured: true, highDemandRule: "MIN_GAP", highDemandGapMinutes: 300, highDemandMaxPerDay: null, petConcurrentCapacity: 1 } as const;
const maxPerDay = { configured: true, highDemandRule: "MAX_PER_DAY", highDemandGapMinutes: null, highDemandMaxPerDay: 1, petConcurrentCapacity: 1 } as const;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_SETTINGS_TEST"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}

test("GET lee configured=false y ambas reglas sin defaults; query namespace PET por local", async t => {
  const responses: unknown[] = [unconfigured, minGap, maxPerDay];
  mockFetch(t, async (url, init) => { assert.equal(url, "/api/pet/admin/settings"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store"); return json(responses.shift()); });
  assert.deepEqual(await petSettingsService.get(), unconfigured);
  assert.deepEqual(await petSettingsService.get(), minGap);
  assert.deepEqual(await petSettingsService.get(), maxPerDay);
  assert.deepEqual(petSettingsQuery("LOCAL").queryKey, ["pet-settings", "LOCAL"]);
  assert.deepEqual(queryKeys.petSettings.detail("LOCAL"), ["pet-settings", "LOCAL"]);
  assert.equal(petSettingsQuery("LOCAL").retry, false);
});

test("DTO rechaza estados híbridos, valores inválidos y configura false solo con nulls", () => {
  assert.deepEqual(parsePetSettingsValue(unconfigured), unconfigured);
  assert.deepEqual(parsePetSettingsValue(minGap), minGap);
  assert.deepEqual(parsePetSettingsValue(maxPerDay), maxPerDay);
  for (const bad of [null, [], {}, { ...unconfigured, petConcurrentCapacity: undefined }, { ...unconfigured, highDemandRule: "MIN_GAP" }, { ...minGap, highDemandMaxPerDay: 1 }, { ...minGap, highDemandGapMinutes: 0 }, { ...minGap, highDemandGapMinutes: 1.5 }, { ...maxPerDay, highDemandMaxPerDay: 2 }, { ...maxPerDay, highDemandMaxPerDay: 2147483648 }]) assert.equal(parsePetSettingsValue(bad), null);
});

test("capacidad admin: DTO entero 1–10, parser GET y payload independiente", () => {
  for (const value of ["1", "2", "10"]) {
    assert.equal(validatePetCapacityDraft(value), null);
    assert.deepEqual(petCapacityPayload(value), { petConcurrentCapacity: Number(value) });
  }
  for (const value of ["", "0", "11", "-1", "1.5", "2e0", "02", " 2", "NaN"]) {
    assert.ok(validatePetCapacityDraft(value)); assert.equal(petCapacityPayload(value), null);
  }
  assert.deepEqual(parsePetCapacityValue({ petConcurrentCapacity: 2 }), { petConcurrentCapacity: 2 });
  for (const value of [null, {}, { petConcurrentCapacity: "2" }, { petConcurrentCapacity: 0 },
    { petConcurrentCapacity: 11 }, { petConcurrentCapacity: 1.5 }]) assert.equal(parsePetCapacityValue(value), null);
  assert.deepEqual(parsePetSettingsValue({ ...unconfigured, petConcurrentCapacity: 2 })?.petConcurrentCapacity, 2);
});

test("formulario renderiza capacidad actual, límites y política prospectiva con Guardar deshabilitado sin cambios", () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.petSettings.detail("LOCAL"), { ...minGap, petConcurrentCapacity: 2 });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(PetSettingsAdmin, { localId: "LOCAL" })));
  assert.match(html, /Capacidad simultánea de mascotas/);
  assert.match(html, /id="pet-settings-capacity"[^>]*type="number"[^>]*min="1"[^>]*max="10"[^>]*step="1"[^>]*value="2"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Guardar capacidad<\/button>/);
  assert.match(html, /value="300"/);
  assert.match(html, /Los cambios afectan nuevas reservas\. Los turnos ya confirmados se conservan\./);
  assert.match(html, /Cantidad máxima de mascotas que el local puede atender al mismo tiempo\./);
  client.clear();
});

test("PUT /settings/capacity guarda por contrato independiente y no envía campos high-demand; 400 tipado", async t => {
  const bodies: unknown[] = [];
  let error = false;
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/settings/capacity"); assert.equal(init.method, "PUT");
    bodies.push(JSON.parse(String(init.body)));
    return error ? json({ error: "inválida" }, 400) : json({ petConcurrentCapacity: 2 });
  });
  assert.deepEqual(await petSettingsService.updateCapacity({ petConcurrentCapacity: 2 }), { petConcurrentCapacity: 2 });
  assert.deepEqual(bodies[0], { petConcurrentCapacity: 2 });
  error = true;
  await assert.rejects(petSettingsService.updateCapacity({ petConcurrentCapacity: 3 }), err =>
    err instanceof PetSettingsApiError && err.status === 400);
});

test("cambio de capacidad refresca cache y disponibilidad sin alterar el draft high-demand", async t => {
  const client = new QueryClient(); t.after(() => client.clear());
  let capacity = 1;
  mockFetch(t, async (url, init) => {
    if (init.method === "PUT") {
      assert.equal(url, "/api/pet/admin/settings/capacity");
      capacity = (JSON.parse(String(init.body)) as { petConcurrentCapacity: number }).petConcurrentCapacity;
      return json({ petConcurrentCapacity: capacity });
    }
    return json({ ...minGap, petConcurrentCapacity: capacity });
  });
  const original = await client.fetchQuery(petSettingsQuery("LOCAL"));
  const dirtyHighDemand = { ...petSettingsDraft(original), value: "301" };
  assert.equal(petSettingsDraftDirty(original, dirtyHighDemand), true);
  await petSettingsService.updateCapacity({ petConcurrentCapacity: 2 });
  await acceptPetCapacity(client, "LOCAL", 2);
  assert.equal(client.getQueryData<typeof minGap>(queryKeys.petSettings.detail("LOCAL"))?.petConcurrentCapacity, 2);
  const invalidated: readonly unknown[][] = [];
  await invalidatePetSettingsDependencies({ invalidateQueries: async ({ queryKey }) => { (invalidated as unknown as unknown[][]).push(queryKey); } }, "LOCAL");
  assert.deepEqual(invalidated, [["pet-settings", "LOCAL"], ["pet-admin-booking", "availability"], ["pet-turno-disponibilidad"]]);
  const current = await client.fetchQuery({ ...petSettingsQuery("LOCAL"), staleTime: 0 });
  assert.equal(current.petConcurrentCapacity, 2);
  assert.equal(current.highDemandRule, original.highDemandRule);
  assert.equal(petSettingsDraftDirty(current, dirtyHighDemand), true);
  assert.equal(petSettingsDraftDirty(current, petSettingsDraft(current)), false);
});

test("hidrata configuración exacta; no configurada produce draft sin selección", () => {
  assert.deepEqual(petSettingsDraft(unconfigured), { rule: null, value: "" });
  assert.deepEqual(petSettingsDraft(minGap), { rule: "MIN_GAP", value: "300" });
  assert.deepEqual(petSettingsDraft(maxPerDay), { rule: "MAX_PER_DAY", value: "1" });
});

test("valida entero positivo sin vacío, cero, negativo, decimal, NaN ni coerción", () => {
  for (const value of ["", "0", "-1", "1.5", "NaN", "1e2", " 2", "2147483648"]) assert.ok(validatePetSettingsDraft({ rule: "MIN_GAP", value }));
  assert.ok(validatePetSettingsDraft({ rule: null, value: "2" }));
  assert.equal(validatePetSettingsDraft({ rule: "MIN_GAP", value: "1" }), null);
  assert.equal(validatePetSettingsDraft({ rule: "MIN_GAP", value: "02" }), null);
  assert.equal(validatePetSettingsDraft({ rule: "MAX_PER_DAY", value: "1" }), null);
  assert.ok(validatePetSettingsDraft({ rule: "MAX_PER_DAY", value: "2" }));
});

test("payloads PUT son completos y mantienen exclusividad al cambiar de regla", () => {
  const gap = petSettingsPayload({ rule: "MIN_GAP", value: "300" });
  const max = petSettingsPayload({ rule: "MAX_PER_DAY", value: "1" });
  assert.deepEqual(gap, { highDemandRule: "MIN_GAP", highDemandGapMinutes: 300, highDemandMaxPerDay: null });
  assert.deepEqual(max, { highDemandRule: "MAX_PER_DAY", highDemandGapMinutes: null, highDemandMaxPerDay: 1 });
  assert.equal(petSettingsMatchesWrite(minGap, gap!), true);
  assert.equal(petSettingsMatchesWrite(minGap, max!), false);
  assert.equal(petSettingsMatchesWrite(maxPerDay, gap!), false);
});

test("PUT reemplaza la configuración con únicamente los tres campos contractuales", async t => {
  const bodies: unknown[] = []; mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/settings"); assert.equal(init.method, "PUT");
    bodies.push(JSON.parse(String(init.body))); return json(maxPerDay);
  });
  const write = petSettingsPayload({ rule: "MAX_PER_DAY", value: "1" })!;
  assert.deepEqual(await petSettingsService.replace(write), maxPerDay);
  assert.deepEqual(bodies, [write]);
  assert.equal("configured" in (bodies[0] as object), false);
});

test("errores HTTP permanecen tipados; mutation nunca se reintenta", async t => {
  let status = 400; mockFetch(t, async (_url, init) => init.method === "PUT" ? json({ error: "internal" }, status) : json(unconfigured));
  for (const expected of [400, 401, 403, 500]) { status = expected; await assert.rejects(petSettingsService.replace(petSettingsPayload({ rule: "MIN_GAP", value: "300" })!), error => error instanceof PetSettingsApiError && error.status === expected); }
  assert.equal(petSettingsMutationPolicy().retry, false);
});

test("incertidumbre reconciliable mediante GET autoritativo y verificar es solo lectura", async t => {
  const client = new QueryClient(); t.after(() => client.clear()); let puts = 0; let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PUT") { puts++; return json({ error: "unknown" }, 500); }
    gets++; return json(minGap);
  });
  await assert.rejects(petSettingsService.replace(petSettingsPayload({ rule: "MIN_GAP", value: "300" })!), { status: 500 });
  const authoritative = await client.fetchQuery({ ...petSettingsQuery("LOCAL"), queryFn: () => petSettingsService.get(), staleTime: 0 });
  assert.equal(petSettingsMatchesWrite(authoritative, petSettingsPayload({ rule: "MIN_GAP", value: "300" })!), true);
  assert.equal(puts, 1); assert.equal(gets, 1);
});

test("submit no-op se identifica por equivalencia exacta; write lock bloquea doble submit", () => {
  assert.equal(petSettingsMatchesWrite(minGap, petSettingsPayload({ rule: "MIN_GAP", value: "300" })!), true);
  assert.equal(petSettingsMatchesWrite(minGap, petSettingsPayload({ rule: "MIN_GAP", value: "301" })!), false);
  const lock = { current: false };
  assert.equal(acquirePetSettingsWriteLock(lock), true); assert.equal(acquirePetSettingsWriteLock(lock), false);
  lock.current = false; assert.equal(acquirePetSettingsWriteLock(lock), true);
});

test("dirty/busy/incertidumbre usan la decisión del guard compartido para navegación", () => {
  let confirms = 0;
  const guard = createPetSettingsNavigationGuard({ dirty: true, busy: false, uncertain: false }, () => { confirms++; return false; });
  assert.equal(guard.hasPendingChanges(), true); assert.equal(guard.canLeave(), false); assert.equal(confirms, 1);
  const busy = createPetSettingsNavigationGuard({ dirty: false, busy: true, uncertain: false }, () => true);
  assert.equal(busy.hasPendingChanges(), true); assert.equal(busy.canLeave(), false);
  const uncertain = createPetSettingsNavigationGuard({ dirty: false, busy: false, uncertain: true }, () => true);
  assert.equal(uncertain.hasPendingChanges(), true); assert.equal(uncertain.canLeave(), true);
  const pristine = createPetSettingsNavigationGuard({ dirty: false, busy: false, uncertain: false }, () => { throw new Error("unexpected confirmation"); });
  assert.equal(pristine.hasPendingChanges(), false); assert.equal(pristine.canLeave(), true);
});

test("invalidaciones limitadas a settings y disponibilidad PET dependiente", async () => {
  const keys: readonly unknown[][] = [];
  await invalidatePetSettingsDependencies({ invalidateQueries: async ({ queryKey }) => { (keys as unknown as unknown[][]).push(queryKey); } }, "LOCAL");
  assert.deepEqual(keys, [["pet-settings", "LOCAL"], ["pet-admin-booking", "availability"], ["pet-turno-disponibilidad"]]);
});

test("Configuración PET es UI propia y conserva Horarios/Bloqueos reales", () => {
  assert.equal(getPetAdminContentKind("configuracion"), "configuracion");
  assert.equal(getPetAdminContentKind("horarios"), "horarios");
  assert.equal(getPetAdminContentKind("bloqueos"), "bloqueos");
});
