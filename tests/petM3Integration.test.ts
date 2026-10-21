import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as tick } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { PetManagementDetail } from "../src/feature/admin/petManagement/types/petManagement.types.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
    try { return next(`${specifier}.ts`, context); } catch { return next(specifier, context); }
  }
  return next(specifier, context);
} });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "M3G_LOCAL_TEST", removeItem: () => {} } });
const { createPetMascotaFormController } = await import("../src/feature/admin/petManagement/state/petMascotaFormController.ts");
const { createPetResponsablesController } = await import("../src/feature/admin/petManagement/state/petResponsablesController.ts");
const { createPetMascotaFlagsController } = await import("../src/feature/admin/petManagement/state/petMascotaFlagsController.ts");
const { createPetMascotaServiciosController } = await import("../src/feature/admin/petManagement/state/petMascotaServiciosController.ts");
const { createPetMascotaExtrasController } = await import("../src/feature/admin/petManagement/state/petMascotaExtrasController.ts");
const { createPetManagementNavigation } = await import("../src/feature/admin/petManagement/state/petManagementNavigation.ts");
const { petServiciosQuery } = await import("../src/feature/admin/petServicios/queries/petServiciosQueries.ts");
const { petExtrasQuery } = await import("../src/feature/admin/petExtras/queries/petExtrasQueries.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");

const catalog = [{ id: 1, nombre: "M3G recurso", activo: 1 }];
const relation = (duration: number, active = 1) => [{ ...catalog[0], activo: active, duracion_minutos: duration }];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const detail: PetManagementDetail = { id: 10, nombre: "M3G Mascota", raza: null, fechaNacimiento: null, sexo: null,
  tamano: null, tipoPelo: null, observaciones: null, activo: true, altaExigencia: false, reservaOnlineHabilitada: false, responsables: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
async function until(predicate: () => boolean) { const start = Date.now(); while (!predicate()) { if (Date.now() - start > 3000) throw Error("M3G timeout"); await tick(); } }
function setup(t: TestContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let allowed = false, confirmations = 0;
  const confirmDiscard = () => { confirmations++; return allowed; };
  const data = createPetMascotaFormController(client, { localId: "M3G", onSelect: () => {}, onUnavailable: () => {}, confirmDiscard });
  const responsables = createPetResponsablesController(client, { localId: "M3G", onUnavailable: () => {}, confirmDiscard, confirmRemove: () => true });
  const flags = createPetMascotaFlagsController(client, { localId: "M3G", onUnavailable: () => {}, confirmChange: () => true });
  const servicios = createPetMascotaServiciosController(client, { localId: "M3G", confirmDiscard, confirmRemove: () => true });
  const extras = createPetMascotaExtrasController(client, { localId: "M3G", confirmDiscard, confirmRemove: () => true });
  data.syncSelection(10, detail); responsables.syncSelection(10, detail); flags.syncSelection(10, detail);
  servicios.syncSelection(10); servicios.syncData(10, catalog, relation(60));
  extras.syncSelection(10); extras.syncData(10, catalog, relation(30));
  const controllers = [data, responsables, flags, servicios, extras];
  t.after(() => { controllers.forEach(c => c.disconnect()); client.clear(); });
  return { client, data, responsables, flags, servicios, extras,
    navigation: createPetManagementNavigation(data, responsables, flags, servicios, extras),
    allow: () => { allowed = true; }, confirmations: () => confirmations,
    snapshots: () => controllers.map(c => c.getSnapshot()),
  };
}

for (const area of ["Datos", "Responsables", "Estado y reservas", "Servicios", "Extras"]) {
  test(`M.3G salida de ficha con ${area} pendiente: misma confirmación M.2, cancelar conserva estado`, async t => {
    const f = setup(t);
    assert.equal(f.navigation.canLeave(), true); assert.equal(f.confirmations(), 0);
    if (area === "Datos") { f.data.beginEdit(detail); f.data.change("raza", "draft"); }
    if (area === "Responsables") { f.responsables.beginAdd(); f.responsables.change("nombre", "draft"); }
    if (area === "Estado y reservas") {
      t.mock.method(globalThis, "fetch", async () => json({}, 500));
      await f.flags.changeFlag("altaExigencia", true);
    }
    if (area === "Servicios") f.servicios.change(1, "75");
    if (area === "Extras") f.extras.change(1, "45");
    const before = f.snapshots();
    assert.equal(f.navigation.hasPendingChanges(), true);
    assert.equal(f.navigation.canLeave(), false); assert.equal(f.confirmations(), 1);
    assert.deepEqual(f.snapshots(), before);
    f.allow(); assert.equal(f.navigation.canLeave(), true); assert.equal(f.confirmations(), 2);
  });
}

test("M.3G cinco áreas dirty comparten una única confirmación; busy bloquea sin descartar", async t => {
  const f = setup(t), gate = deferred<Response>();
  t.mock.method(globalThis, "fetch", async () => json({}, 500));
  await f.flags.changeFlag("altaExigencia", true);
  assert.equal(f.flags.getSnapshot().dirty, true);
  f.data.beginEdit(detail); f.data.change("raza", "draft");
  f.responsables.beginAdd(); f.responsables.change("nombre", "draft");
  f.servicios.change(1, "75"); f.extras.change(1, "45");
  assert.equal(f.navigation.canLeave(), false); assert.equal(f.confirmations(), 1);
  t.mock.method(globalThis, "fetch", () => gate.promise);
  const writing = f.extras.save(1);
  assert.equal(f.navigation.canLeave(), false); assert.equal(f.confirmations(), 1);
  assert.equal(f.navigation.hasPendingChanges(), true);
  f.extras.disconnect(); gate.resolve(json({}, 500)); await writing;
});

for (const target of ["servicios", "extras"] as const) {
  test(`M.3G PATCH incierto ${target}: GET sin replay, preserva drafts cruzados y detalle`, async t => {
    const f = setup(t), calls: string[] = [];
    f.data.beginEdit(detail); f.data.change("raza", "Datos dirty");
    f.responsables.beginAdd(); f.responsables.change("nombre", "Responsable dirty");
    f.servicios.change(1, "75"); f.extras.change(1, "45");
    const other = target === "servicios" ? f.extras : f.servicios;
    const before = [f.data.getSnapshot(), f.responsables.getSnapshot(), f.flags.getSnapshot(), other.getSnapshot()];
    const key = queryKeys.petManagement.detail("M3G", 10); f.client.setQueryData(key, detail);
    t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.ok(String(url).endsWith(`/mascotas/10/${target}`) || String(url).endsWith(`/mascotas/10/${target}/1`));
      calls.push(String(init?.method));
      return init?.method === "PATCH" ? json({}, 500) : json(relation(target === "servicios" ? 75 : 45));
    });
    assert.equal(await f[target].save(1), true);
    assert.deepEqual(calls, ["PATCH", "GET"]);
    assert.deepEqual([f.data.getSnapshot(), f.responsables.getSnapshot(), f.flags.getSnapshot(), other.getSnapshot()], before);
    assert.deepEqual(f.client.getQueryData(key), detail);
    assert.equal(f.client.getQueryState(key)?.isInvalidated, false);
  });
}

test("M.3G catálogos observados: inactivar/reactivar reconcilia ambas áreas sin perder relaciones ni drafts", async t => {
  const f = setup(t);
  f.servicios.change(1, "75"); f.extras.change(1, "45");
  const observers = [new QueryObserver(f.client, { ...petServiciosQuery("M3G"), enabled: false }),
    new QueryObserver(f.client, { ...petExtrasQuery("M3G"), enabled: false })];
  const unsubscribes = observers.map((observer, i) => observer.subscribe(result => {
    if (result.data) {
      if (i === 0) f.servicios.syncData(10, result.data, relation(60, result.data[0].activo));
      else f.extras.syncData(10, result.data, relation(30, result.data[0].activo));
    }
  }));
  t.after(() => unsubscribes.forEach(fn => fn()));
  for (const activo of [0, 1]) {
    f.client.setQueryData(queryKeys.petServicios.all("M3G"), [{ ...catalog[0], activo }]);
    f.client.setQueryData(queryKeys.petExtras.all("M3G"), [{ ...catalog[0], activo }]);
    await tick();
    for (const c of [f.servicios, f.extras]) { assert.equal(c.getSnapshot().rows[0].activo, Boolean(activo)); assert.equal(c.getSnapshot().rows[0].permitido, true); }
    assert.equal(f.servicios.getSnapshot().rows[0].value, "75"); assert.equal(f.extras.getSnapshot().rows[0].value, "45");
  }
});

test("M.3G A→B conjunto: reconciliaciones Servicios y Extras tardías no contaminan drafts ni incertidumbre B", async t => {
  const f = setup(t), serviceGate = deferred<Response>(), extraGate = deferred<Response>();
  let gets = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const service = String(url).includes("/servicios");
    if (init?.method === "PATCH") return json(service ? { servicioId: 1, duracion_minutos: 75 } : { ...catalog[0], duracion_minutos: 45 });
    gets++; return service ? serviceGate.promise : extraGate.promise;
  });
  f.servicios.change(1, "75"); f.extras.change(1, "45");
  const writes = [f.servicios.save(1), f.extras.save(1)];
  await until(() => gets === 2);
  f.servicios.syncSelection(20); f.servicios.syncData(20, catalog, relation(90)); f.servicios.change(1, "95");
  f.extras.syncSelection(20); f.extras.syncData(20, catalog, relation(15)); f.extras.change(1, "20");
  // B already has its own uncertain writes: late A must not clear either context.
  t.mock.method(globalThis, "fetch", async () => json({}, 500));
  assert.deepEqual(await Promise.all([f.servicios.save(1), f.extras.save(1)]), [false, false]);
  assert.ok(f.servicios.getSnapshot().verification); assert.ok(f.extras.getSnapshot().verification);
  const before = [f.servicios.getSnapshot(), f.extras.getSnapshot()];
  serviceGate.resolve(json(relation(75))); extraGate.resolve(json(relation(45)));
  assert.deepEqual(await Promise.all(writes), [false, false]);
  assert.deepEqual([f.servicios.getSnapshot(), f.extras.getSnapshot()], before);
  assert.equal(f.servicios.getSnapshot().mascotaId, 20); assert.equal(f.extras.getSnapshot().mascotaId, 20);
});
