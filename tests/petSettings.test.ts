import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { QueryClient } from "@tanstack/react-query";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
    try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier); }
  }
  return nextResolve(specifier);
} });

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const { petSettingsService, PetSettingsApiError } = await import("../src/feature/admin/petSettings/services/petSettings.service.ts");
const { petSettingsQuery, petSettingsMutationPolicy, acquirePetSettingsWriteLock, createPetSettingsNavigationGuard, invalidatePetSettingsDependencies } = await import("../src/feature/admin/petSettings/queries/petSettingsQueries.ts");
const { parsePetSettingsValue, petSettingsDraft, petSettingsPayload, petSettingsMatchesWrite, validatePetSettingsDraft } = await import("../src/feature/admin/petSettings/types/petSettings.types.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const { getPetAdminContentKind } = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");

const unconfigured = { configured: false, highDemandRule: null, highDemandGapMinutes: null, highDemandMaxPerDay: null } as const;
const minGap = { configured: true, highDemandRule: "MIN_GAP", highDemandGapMinutes: 300, highDemandMaxPerDay: null } as const;
const maxPerDay = { configured: true, highDemandRule: "MAX_PER_DAY", highDemandGapMinutes: null, highDemandMaxPerDay: 2 } as const;
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
  for (const bad of [null, [], {}, { ...unconfigured, highDemandRule: "MIN_GAP" }, { ...minGap, highDemandMaxPerDay: 1 }, { ...minGap, highDemandGapMinutes: 0 }, { ...minGap, highDemandGapMinutes: 1.5 }, { ...maxPerDay, highDemandMaxPerDay: 2147483648 }]) assert.equal(parsePetSettingsValue(bad), null);
});

test("hidrata configuración exacta; no configurada produce draft sin selección", () => {
  assert.deepEqual(petSettingsDraft(unconfigured), { rule: null, value: "" });
  assert.deepEqual(petSettingsDraft(minGap), { rule: "MIN_GAP", value: "300" });
  assert.deepEqual(petSettingsDraft(maxPerDay), { rule: "MAX_PER_DAY", value: "2" });
});

test("valida entero positivo sin vacío, cero, negativo, decimal, NaN ni coerción", () => {
  for (const value of ["", "0", "-1", "1.5", "NaN", "1e2", " 2", "2147483648"]) assert.ok(validatePetSettingsDraft({ rule: "MIN_GAP", value }));
  assert.ok(validatePetSettingsDraft({ rule: null, value: "2" }));
  assert.equal(validatePetSettingsDraft({ rule: "MIN_GAP", value: "1" }), null);
  assert.equal(validatePetSettingsDraft({ rule: "MIN_GAP", value: "02" }), null);
  assert.equal(validatePetSettingsDraft({ rule: "MAX_PER_DAY", value: "2147483647" }), null);
});

test("payloads PUT son completos y mantienen exclusividad al cambiar de regla", () => {
  const gap = petSettingsPayload({ rule: "MIN_GAP", value: "300" });
  const max = petSettingsPayload({ rule: "MAX_PER_DAY", value: "2" });
  assert.deepEqual(gap, { highDemandRule: "MIN_GAP", highDemandGapMinutes: 300, highDemandMaxPerDay: null });
  assert.deepEqual(max, { highDemandRule: "MAX_PER_DAY", highDemandGapMinutes: null, highDemandMaxPerDay: 2 });
  assert.equal(petSettingsMatchesWrite(minGap, gap!), true);
  assert.equal(petSettingsMatchesWrite(minGap, max!), false);
  assert.equal(petSettingsMatchesWrite(maxPerDay, gap!), false);
});

test("PUT reemplaza la configuración con únicamente los tres campos contractuales", async t => {
  const bodies: unknown[] = []; mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/settings"); assert.equal(init.method, "PUT");
    bodies.push(JSON.parse(String(init.body))); return json(maxPerDay);
  });
  const write = petSettingsPayload({ rule: "MAX_PER_DAY", value: "2" })!;
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
