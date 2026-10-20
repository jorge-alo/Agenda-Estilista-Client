import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { setImmediate as nextTick } from "node:timers/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { PetMascotaServicio } from "../src/feature/admin/petManagement/types/petMascotaServicios.types.ts";
import type { PetManagementDetail } from "../src/feature/admin/petManagement/types/petManagement.types.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key),
} });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const { petMascotaServiciosService: api } = await import("../src/feature/admin/petManagement/services/petMascotaServicios.service.ts");
const { createPetMascotaServiciosController } = await import("../src/feature/admin/petManagement/state/petMascotaServiciosController.ts");
const { petMascotaServiciosQuery, petMascotaServicioMutation } = await import("../src/feature/admin/petManagement/queries/petMascotaServiciosQueries.ts");
const { combinePetMascotaServicios, parsePetDuracion, petMascotaServiciosError, petMascotaServicioRemoveConfirmation } = await import("../src/feature/admin/petManagement/types/petMascotaServicios.types.ts");
const { PetMascotaServicios } = await import("../src/feature/admin/petManagement/components/PetMascotaServicios.tsx");
const { PetManagementDetail: DetailView } = await import("../src/feature/admin/petManagement/components/PetManagementDetail.tsx");
const { createPetMascotaFormController } = await import("../src/feature/admin/petManagement/state/petMascotaFormController.ts");
const { createPetResponsablesController } = await import("../src/feature/admin/petManagement/state/petResponsablesController.ts");
const { createPetMascotaFlagsController } = await import("../src/feature/admin/petManagement/state/petMascotaFlagsController.ts");
const { PetServiciosApiError } = await import("../src/feature/admin/petServicios/services/petServicios.service.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");

const catalog = [
  { id: 1, nombre: "Baño", activo: 1, duracion: 999 },
  { id: 2, nombre: "Baño y corte", activo: 1, duracion: 888 },
  { id: 3, nombre: "Stripping", activo: 0, duracion: 777 },
  { id: 4, nombre: "Deslanado", activo: 0, duracion: 666 },
];
const relation = (id = 2, duration = 60, activo: 0 | 1 = 1): PetMascotaServicio => ({ id, nombre: catalog.find(item => item.id === id)?.nombre ?? "Remoto", activo, duracion_minutos: duration });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const ack = (id = 2, duration = 75, status = 200) => json({ servicioId: id, duracion_minutos: duration }, status);
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_RELATION_TEST_TOKEN"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}
function setup(t: TestContext, relations: PetMascotaServicio[] = [relation()]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let allow = true; let confirms = 0;
  const controller = createPetMascotaServiciosController(client, { localId: "L", confirmDiscard: () => allow,
    confirmRemove: () => { confirms++; return allow; } });
  controller.syncSelection(10); controller.syncData(10, catalog, relations);
  t.after(() => { controller.disconnect(); client.clear(); });
  return { client, controller, rejectConfirmation: () => { allow = false; }, confirmations: () => confirms };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { resolve, promise }; }
async function waitFor(fn: () => boolean) { const start = Date.now(); while (!fn()) { if (Date.now() - start > 2000) throw new Error("timeout"); await nextTick(); } }
function detail(): PetManagementDetail { return { id: 10, nombre: "Firu", raza: "Original", fechaNacimiento: null, sexo: null,
  tamano: null, tipoPelo: null, observaciones: null, activo: false, altaExigencia: false, reservaOnlineHabilitada: false, responsables: [] }; }

test("vista combinada determinista: cuatro estados, relación fuera del catálogo stale y duración sin fallback", () => {
  const relations = [relation(2, 60), relation(3, 90, 0), relation(9, 45)];
  const before = structuredClone({ catalog, relations });
  assert.deepEqual(combinePetMascotaServicios(catalog, relations), [
    { id: 1, nombre: "Baño", activo: true, permitido: false, duracionMinutos: null },
    { id: 2, nombre: "Baño y corte", activo: true, permitido: true, duracionMinutos: 60 },
    { id: 3, nombre: "Stripping", activo: false, permitido: true, duracionMinutos: 90 },
    { id: 4, nombre: "Deslanado", activo: false, permitido: false, duracionMinutos: null },
    { id: 9, nombre: "Remoto", activo: true, permitido: true, duracionMinutos: 45 },
  ]);
  assert.deepEqual({ catalog, relations }, before);
});

test("render dentro de ficha: duración de relación, inactivos visibles, sin precio ni Extras", t => {
  const { controller } = setup(t, [relation(2, 60), relation(3, 90, 0)]);
  const section = createElement(PetMascotaServicios, { servicios: { controller, state: controller.getSnapshot(), loading: false, fetching: false, error: null, refresh: () => {} }, disabled: false });
  const html = renderToStaticMarkup(createElement(DetailView, { selectedMascotaId: 10, detail: detail(), loading: false, fetching: false,
    errorMessage: null, notFound: false, onRefresh: () => {}, responsablesContent: "Responsables", flagsContent: "Estado y reservas", serviciosContent: section }));
  assert.match(html, /Servicios permitidos/); assert.match(html, /value="60"/); assert.match(html, /value="90"/);
  assert.match(html, /No disponible para nuevas configuraciones/); assert.match(html, /configuración se conserva/);
  assert.equal((html.match(/Permitir servicio/g) ?? []).length, 1);
  assert.equal((html.match(/Quitar de esta mascota/g) ?? []).length, 2);
  assert.doesNotMatch(html, /999|888|777|666|precio|Extras|Eliminar servicio/);
});

test("render loading/error/empty distingue catálogo vacío y maneja error con actualización manual", t => {
  const { controller } = setup(t, []); controller.syncData(10, [], []);
  const render = (loading: boolean, error: Error | null) => renderToStaticMarkup(createElement(PetMascotaServicios,
    { servicios: { controller, state: controller.getSnapshot(), loading, fetching: false, error, refresh: () => {} }, disabled: false }));
  assert.match(render(true, null), /Cargando servicios/); assert.doesNotMatch(render(true, null), /No hay servicios/);
  assert.match(render(false, null), /No hay servicios/);
  assert.match(render(false, new PetServiciosApiError(403)), /No tenés permisos/);
  assert.doesNotMatch(render(false, new PetServiciosApiError(500)), /No hay servicios/);
});

for (const value of ["", "0", "-1", "1.5", "2147483648", "1e2", " 60", "+60", "hola"]) {
  test(`duración inválida ${JSON.stringify(value)}: sin POST ni relación ambigua`, async t => {
    const { controller } = setup(t, []); let calls = 0; mockFetch(t, async () => { calls++; return ack(); });
    assert.equal(parsePetDuracion(value), null); controller.change(1, value); assert.equal(await controller.save(1), false);
    assert.equal(calls, 0); assert.equal(controller.getSnapshot().rows[0].permitido, false); assert.ok(controller.getSnapshot().drafts[1].error);
  });
}
for (const value of ["1", "60", "2147483647"]) test(`duración válida ${value} respeta INT signed`, () => assert.equal(parsePetDuracion(value), Number(value)));

test("GET tipado: DTO propio, orden recibido, NULL legacy inactivo y sin duración del catálogo", async t => {
  mockFetch(t, async (url, init) => { assert.equal(url, "/api/pet/admin/mascotas/10/servicios"); assert.equal(init.method, "GET");
    assert.equal(init.cache, "no-store"); assert.equal((init.headers as Record<string, string>).Authorization, "Bearer PET_RELATION_TEST_TOKEN");
    return json([{ ...relation(2, 60), duracion: 888, precio: 100 }, { ...relation(3, 90), activo: null }]); });
  assert.deepEqual(await api.getPetMascotaServicios(10), [relation(2, 60), relation(3, 90, 0)]);
});

test("API POST/PATCH/DELETE exactos: numéricos, PATCH solo duración, DELETE solo relación", async t => {
  const calls: string[] = []; const bodies: unknown[] = [];
  mockFetch(t, async (url, init) => { calls.push(`${init.method} ${url}`); bodies.push(init.body ? JSON.parse(String(init.body)) : undefined);
    return init.method === "DELETE" ? new Response(null, { status: 204 }) : ack(2, 75, init.method === "POST" ? 201 : 200); });
  await api.addPetMascotaServicio(10, { servicioId: 2, duracionMinutos: 75, local_id: 99 } as { servicioId: number; duracionMinutos: number });
  await api.updatePetMascotaServicio(10, 2, { duracionMinutos: 75, nombre: "NO", activo: false } as { duracionMinutos: number });
  await api.removePetMascotaServicio(10, 2);
  assert.deepEqual(calls, ["POST /api/pet/admin/mascotas/10/servicios", "PATCH /api/pet/admin/mascotas/10/servicios/2", "DELETE /api/pet/admin/mascotas/10/servicios/2"]);
  assert.deepEqual(bodies, [{ servicioId: 2, duracionMinutos: 75 }, { duracionMinutos: 75 }, undefined]);
});

test("API rechaza IDs y duración inválida antes de request; DTO corrupto no inventa fallback", async t => {
  let calls = 0; mockFetch(t, async () => { calls++; return json([{ id: 2, nombre: "Baño", activo: 1, duracion: 888 }]); });
  for (const value of [0, -1, 1.5, 2147483648, "60", NaN, Infinity]) {
    await assert.rejects(api.addPetMascotaServicio(10, { servicioId: 2, duracionMinutos: value as number }), { status: 400 });
  }
  await assert.rejects(api.getPetMascotaServicios(0), { status: 400 });
  await assert.rejects(api.updatePetMascotaServicio(10, -1, { duracionMinutos: 60 }), { status: 400 });
  assert.equal(calls, 0); await assert.rejects(api.getPetMascotaServicios(10), { status: 200 });
});

test("alta activa: POST → GET autoritativo; doble submit síncrono bloqueado y retry false", async t => {
  const { controller, client } = setup(t, []); const gate = deferred<Response>(); const calls: string[] = [];
  mockFetch(t, async (url, init) => { calls.push(`${init.method} ${url}`); return init.method === "POST" ? gate.promise : json([relation(1, 60)]); });
  controller.change(1, "60"); const writing = controller.save(1);
  assert.equal(controller.getSnapshot().busy, true); assert.equal(await controller.save(1), false);
  await waitFor(() => calls.length === 1); gate.resolve(ack(1, 60, 201)); assert.equal(await writing, true);
  assert.equal(petMascotaServicioMutation("L").retry, false); assert.equal(petMascotaServiciosQuery("L", 10).retry, false);
  assert.deepEqual(calls.map(item => item.split(" ")[0]), ["POST", "GET"]);
  assert.equal(controller.getSnapshot().rows[0].permitido, true);
  assert.deepEqual(client.getQueryData(queryKeys.petMascotaServicios.all("L", 10)), [relation(1, 60)]);
});

test("inactivo sin relación no admite alta; relación inactiva permite PATCH y mascota inactiva no agrega bloqueo", async t => {
  const { controller } = setup(t, [relation(3, 90, 0)]); let writes = 0;
  mockFetch(t, async (_url, init) => { if (init.method === "PATCH") { writes++; return ack(3, 100); } return json([relation(3, 100, 0)]); });
  controller.change(4, "60"); assert.equal(await controller.save(4), false);
  controller.change(3, "100"); assert.equal(await controller.save(3), true); assert.equal(writes, 1);
  assert.equal(controller.getSnapshot().rows[2].value, "100"); assert.equal(controller.getSnapshot().rows[2].permitido, true);
});

for (const method of ["POST", "PATCH", "DELETE"] as const) {
  for (const applied of [true, false]) {
    test(`${method} incierto ${applied ? "aplicado" : "no aplicado"}: un write y GET sin replay, adopta backend`, async t => {
      const { controller } = setup(t, method === "POST" ? [] : [relation()]); const calls: string[] = [];
      let laterApplied = false;
      mockFetch(t, async (_url, init) => {
        calls.push(String(init.method)); if (init.method !== "GET") return json({ error: "PRIVATE" }, 500);
        return json(method === "POST" ? applied || laterApplied ? [relation(2, 80)] : []
          : method === "PATCH" ? [relation(2, applied ? 75 : 60)] : applied ? [] : [relation()]);
      });
      controller.change(2, "75");
      const result = method === "DELETE" ? await controller.remove(2) : await controller.save(2);
      assert.equal(result, applied); assert.deepEqual(calls, [method, "GET"]);
      const row = controller.getSnapshot().rows[1];
      assert.equal(row.permitido, method === "DELETE" ? !applied : method !== "POST" || applied);
      assert.equal(row.value, method === "POST" ? applied ? "80" : "75" : method === "PATCH" ? applied ? "75" : "60" : applied ? "" : "60");
      if (method === "POST" && !applied) {
        assert.deepEqual(controller.getSnapshot().verification, { kind: "add", servicioId: 2, duracionMinutos: 75 });
        assert.equal(controller.getSnapshot().dirty, true);
        const html = renderToStaticMarkup(createElement(PetMascotaServicios, { servicios: { controller,
          state: controller.getSnapshot(), loading: false, fetching: false, error: null, refresh: () => {} }, disabled: false }));
        assert.match(html, /Verificar nuevamente/);
        assert.equal(await controller.save(2), false);
        assert.equal(await controller.verify(), false);
        assert.deepEqual(calls, ["POST", "GET", "GET"]);
        assert.equal(controller.getSnapshot().rows[1].value, "75");
        laterApplied = true;
        assert.equal(await controller.verify(), true);
        assert.deepEqual(calls, ["POST", "GET", "GET", "GET"]);
        assert.equal(controller.getSnapshot().rows[1].value, "80");
      }
      assert.equal(controller.getSnapshot().verification, null);
      if (!applied && method !== "POST") assert.match(controller.getSnapshot().errorMessage!, /No se pudo confirmar/);
    });
  }
}

test("PATCH success y no-op: solo duracionMinutos, GET puede devolver otro valor sin rollback", async t => {
  const { controller } = setup(t); let writes = 0;
  mockFetch(t, async (_url, init) => { if (init.method === "PATCH") { writes++; assert.deepEqual(JSON.parse(String(init.body)), { duracionMinutos: 75 }); return ack(); } return json([relation(2, 80)]); });
  assert.equal(await controller.save(2), true); assert.equal(writes, 0);
  controller.change(2, "75"); assert.equal(await controller.save(2), false);
  assert.equal(controller.getSnapshot().rows[1].value, "80"); assert.equal(writes, 1);
});

test("DELETE confirmado requiere confirmación, conserva catálogo y permite posterior alta explícita", async t => {
  const { controller, client, confirmations } = setup(t); const key = queryKeys.petServicios.all("L"); client.setQueryData(key, catalog);
  mockFetch(t, async (_url, init) => init.method === "DELETE" ? new Response(null, { status: 204 }) : json([]));
  assert.equal(await controller.remove(2), true); assert.equal(confirmations(), 1);
  assert.equal(controller.getSnapshot().rows[1].permitido, false); assert.deepEqual(client.getQueryData(key), catalog);
  assert.match(petMascotaServicioRemoveConfirmation("Baño"), /duración.*eliminará.*seguirá existiendo en el catálogo/);
});

test("cancelar confirmación DELETE no escribe ni consulta", async t => {
  const { controller, rejectConfirmation } = setup(t); rejectConfirmation(); let calls = 0;
  mockFetch(t, async () => { calls++; return json([]); }); assert.equal(await controller.remove(2), false); assert.equal(calls, 0);
});

test("GET de verificación falla: contexto retenido, bloquea writes y Verificar nuevamente solo lee", async t => {
  const { controller } = setup(t); let gets = 0; let writes = 0;
  mockFetch(t, async (_url, init) => { if (init.method !== "GET") { writes++; return ack(); } gets++; return gets === 1 ? json({}, 500) : json([relation(2, 85)]); });
  controller.change(2, "75"); assert.equal(await controller.save(2), false);
  assert.ok(controller.getSnapshot().verification); assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(await controller.save(2), false); assert.equal(await controller.remove(2), false);
  assert.equal(await controller.verify(), false); assert.equal(writes, 1); assert.equal(gets, 2);
  assert.equal(controller.getSnapshot().rows[1].value, "85"); assert.equal(controller.getSnapshot().verification, null);
});

for (const status of [400, 401, 403, 404, 409, 500]) test(`error HTTP ${status}: sanitizado, recovery según status y sin retry`, async t => {
  const { controller } = setup(t, []); let writes = 0; let gets = 0;
  mockFetch(t, async (url, init) => { if (init.method === "POST") { writes++; return json({ error: "PRIVATE_REMOTE_TEXT" }, status); }
    gets++; return json(url.endsWith("/mascotas/10/servicios") ? [] : catalog.map(item => ({ id: item.id, nombre: item.nombre, activo: item.activo }))); });
  controller.change(1, "60"); assert.equal(await controller.save(1), false); assert.equal(writes, 1);
  assert.equal(gets, [400, 401, 403].includes(status) ? 0 : status === 409 ? 2 : 1);
  assert.doesNotMatch(controller.getSnapshot().errorMessage!, /PRIVATE/); assert.ok(petMascotaServiciosError(new PetServiciosApiError(status)));
  if (status === 401) { assert.equal(storage.has("token"), false); assert.equal(window.location.href, "/login"); }
});

test("network y ack malformado se reconcilian sin asumir éxito", async t => {
  const { controller } = setup(t); let writes = 0;
  mockFetch(t, async (_url, init) => { if (init.method !== "GET") { writes++; if (writes === 1) throw new Error("PRIVATE_NETWORK"); return json({ servicioId: 99, duracion_minutos: 90 }); } return json([relation(2, writes === 1 ? 80 : 90)]); });
  controller.change(2, "75"); assert.equal(await controller.save(2), false); assert.equal(controller.getSnapshot().rows[1].value, "80");
  controller.change(2, "90"); assert.equal(await controller.save(2), true); assert.equal(writes, 2);
});

test("refetch y write de otro servicio preservan duración dirty y advierten cambio remoto", async t => {
  const { controller } = setup(t); controller.change(2, "75");
  controller.syncData(10, catalog, [relation(2, 85)]);
  assert.equal(controller.getSnapshot().rows[1].value, "75"); assert.equal(controller.getSnapshot().rows[1].serverChanged, true);
  mockFetch(t, async (_url, init) => init.method === "POST" ? ack(1, 30, 201) : json([relation(1, 30), relation(2, 90)]));
  controller.change(1, "30"); assert.equal(await controller.save(1), true);
  assert.equal(controller.getSnapshot().rows[1].value, "75"); assert.equal(controller.getSnapshot().rows[1].serverChanged, true);
  controller.discard(2); assert.equal(controller.getSnapshot().rows[1].value, "90");
});

test("base null de alta no se rebasa al aparecer relación remota; pristine sí sigue backend", async t => {
  const { controller } = setup(t, []); controller.change(1, "40"); controller.syncData(10, catalog, [relation(1, 50)]);
  controller.change(1, "inválido"); assert.equal(await controller.save(1), false); assert.equal(controller.getSnapshot().rows[0].serverChanged, true);
  controller.change(1, "45"); assert.equal(controller.getSnapshot().rows[0].serverChanged, true);
  controller.discard(1); assert.equal(controller.getSnapshot().rows[0].value, "50");
  controller.change(1, "50"); controller.syncData(10, catalog, [relation(1, 55)]); assert.equal(controller.getSnapshot().rows[0].value, "55");
  controller.change(1, "65"); controller.syncData(10, catalog, [relation(1, 70)]); controller.change(1, "55");
  assert.equal(controller.getSnapshot().rows[0].value, "70"); assert.equal(controller.getSnapshot().dirty, false);
});

test("GET Servicios no resetea drafts Datos/Responsables ni flags; dirty se compone en confirmación M.2", async t => {
  const { controller, client } = setup(t); let confirmations = 0;
  const data = createPetMascotaFormController(client, { localId: "L", onSelect: () => {}, onUnavailable: () => {}, confirmDiscard: () => { confirmations++; return false; } });
  const responsables = createPetResponsablesController(client, { localId: "L", onUnavailable: () => {}, confirmDiscard: () => false, confirmRemove: () => true });
  const flags = createPetMascotaFlagsController(client, { localId: "L", onUnavailable: () => {}, confirmChange: () => true });
  t.after(() => { data.disconnect(); responsables.disconnect(); flags.disconnect(); });
  flags.syncSelection(10, detail());
  mockFetch(t, async () => json({}, 500));
  assert.equal(await flags.changeFlag("altaExigencia", true), false);
  assert.equal(flags.getSnapshot().dirty, true);
  const beforeFlags = flags.getSnapshot();
  data.syncSelection(10, detail()); data.beginEdit(detail()); data.change("raza", "Datos dirty");
  responsables.syncSelection(10, detail()); responsables.beginAdd(); responsables.change("nombre", "Responsable dirty");
  const beforeData = data.getSnapshot(); const beforeResponsables = responsables.getSnapshot();
  const key = queryKeys.petManagement.detail("L", 10); client.setQueryData(key, detail());
  mockFetch(t, async (url, init) => { assert.equal(url, "/api/pet/admin/mascotas/10/servicios" ); return init.method === "PATCH" ? ack() : json([relation(2, 75)]); });
  controller.change(2, "75"); assert.equal(data.selectMascota(20, controller.getSnapshot().dirty), false); assert.equal(confirmations, 1);
  assert.equal(await controller.save(2), true);
  assert.deepEqual(data.getSnapshot(), beforeData); assert.deepEqual(responsables.getSnapshot(), beforeResponsables);
  assert.deepEqual(flags.getSnapshot(), beforeFlags);
  assert.deepEqual(client.getQueryData(key), detail()); assert.equal(client.getQueryState(key)?.isInvalidated, false);
});

test("query keys separan catálogo/mascota/tenant e invalidan solo consumidores PET de esa mascota", async t => {
  const { controller, client } = setup(t);
  const affected = [queryKeys.petAdminBooking.servicios(10), queryKeys.petAdminBooking.availability(10, 2, [], "2026-10-20"), queryKeys.petBooking.options("slug", "S", 10), queryKeys.petBooking.availability("slug", "S", 10, 2, [], "2026-10-20")];
  const untouched = [queryKeys.petServicios.all("L"), queryKeys.petMascotaServicios.all("OTHER", 10), queryKeys.petMascotaServicios.all("L", 20), queryKeys.petManagement.detail("L", 10), queryKeys.petAdminBooking.servicios(20), queryKeys.petAdminBooking.extras(10), queryKeys.petBooking.options("slug", "S", 20), queryKeys.turnos.all, queryKeys.petTurnos.all];
  for (const key of [...affected, ...untouched]) client.setQueryData(key, "snapshot");
  mockFetch(t, async (_url, init) => init.method === "PATCH" ? ack() : json([relation(2, 75)]));
  controller.change(2, "75"); await controller.save(2);
  for (const key of affected) assert.equal(client.getQueryState(key)?.isInvalidated, true);
  for (const key of untouched) assert.equal(client.getQueryState(key)?.isInvalidated, false);
});

test("GET anterior a PATCH se cancela: una respuesta vieja no revierte estado reconciliado", async t => {
  const { controller, client } = setup(t); const gate = deferred<Response>(); let gets = 0; let aborted = false;
  mockFetch(t, async (_url, init) => { if (init.method === "PATCH") return ack(); gets++;
    if (gets === 1) { init.signal?.addEventListener("abort", () => { aborted = true; }); return gate.promise; }
    return json([relation(2, 75)]); });
  const observer = new QueryObserver(client, petMascotaServiciosQuery("L", 10)); const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe);
  await waitFor(() => gets === 1); controller.change(2, "75"); assert.equal(await controller.save(2), true);
  assert.equal(aborted, true); gate.resolve(json([relation(2, 60)])); await nextTick();
  assert.equal(observer.getCurrentResult().data?.[0].duracion_minutos, 75);
});

test("respuesta tardía no afecta otra mascota; unmount impide GET tardío y escritura nueva", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let calls = 0;
  mockFetch(t, async () => { calls++; return gate.promise; }); controller.change(2, "75"); const writing = controller.save(2);
  await waitFor(() => calls === 1); controller.syncSelection(20); controller.syncData(20, catalog, [relation(2, 100)]);
  gate.resolve(ack()); assert.equal(await writing, false); assert.equal(controller.getSnapshot().rows[1].value, "100"); assert.equal(calls, 1);
  // A post-write reconciliation GET from A also cannot replace B, even if transport ignores abort.
  const readGate = deferred<Response>(); const reconciliationCalls: string[] = [];
  controller.syncSelection(10); controller.syncData(10, catalog, [relation()]);
  mockFetch(t, async (_url, init) => { reconciliationCalls.push(String(init.method)); return init.method === "PATCH" ? ack() : readGate.promise; });
  controller.change(2, "75"); const reconciling = controller.save(2);
  await waitFor(() => reconciliationCalls.length === 2);
  controller.syncSelection(20); controller.syncData(20, catalog, [relation(2, 100)]);
  readGate.resolve(json([relation(2, 75)])); assert.equal(await reconciling, false);
  controller.syncData(10, catalog, [relation(2, 75)]);
  assert.equal(controller.getSnapshot().mascotaId, 20); assert.equal(controller.getSnapshot().rows[1].value, "100");
  assert.equal(controller.getSnapshot().verification, null);
  controller.disconnect(); assert.equal(await controller.save(2), false);
});
