import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { QueryClient } from "@tanstack/react-query";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) { try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier); } }
  return nextResolve(specifier);
} });
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });
const { petSolicitudesService, PetSolicitudesApiError } = await import("../src/feature/admin/petSolicitudes/services/petSolicitudes.service.ts");
const { petSolicitudesQuery, petSolicitudesMutationPolicy, acquirePetSolicitudWriteLock, createPetSolicitudesNavigationGuard, invalidatePetSolicitudes } = await import("../src/feature/admin/petSolicitudes/queries/petSolicitudesQueries.ts");
const { conversionDraft, parsePetSolicitudes, petSolicitudActions, parsePetSolicitudConversion } = await import("../src/feature/admin/petSolicitudes/types/petSolicitudes.types.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const { getPetAdminContentKind } = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");
const solicitud = { id: 7, responsable: { nombre: "Ana", telefono: "112", telefonoSecundario: "113" }, mascota: { nombre: "Firulais", raza: "Caniche", fechaNacimiento: "2020-01-01", tamano: "mediano", sexo: "macho" }, motivoContacto: "Baño", estado: "NUEVA", createdAt: "2026-10-21T10:00:00.000Z", updatedAt: "2026-10-21T10:00:00.000Z" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) { storage.set("token", "PET_SOLICITUD_TEST"); window.location.href = ""; t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {})); }

test("GET Todas no agrega query; GET estado filtra y ambas respuestas se validan", async t => {
  const urls: string[] = []; mockFetch(t, async (url, init) => { urls.push(url); assert.equal(init.method, "GET"); return json([solicitud]); });
  assert.deepEqual(await petSolicitudesService.list(null), [parsePetSolicitudes([solicitud])![0]]);
  await petSolicitudesService.list("CONTACTADA");
  assert.deepEqual(urls, ["/api/pet/admin/solicitudes", "/api/pet/admin/solicitudes?estado=CONTACTADA"]);
  assert.equal(parsePetSolicitudes([{ ...solicitud, estado: "OTRO" }]), null);
});

test("listado vacío permanece vacío y el detalle no requiere endpoint adicional", async t => {
  const requested: string[] = []; mockFetch(t, async url => { requested.push(url); return json([]); });
  const rows = await petSolicitudesService.list(null);
  assert.deepEqual(rows, []);
  assert.deepEqual(requested, ["/api/pet/admin/solicitudes"]);
});

test("PATCH transición y POST conversión usan cuerpos contractuales y no se reintentan", async t => {
  const calls: { url: string; init: RequestInit }[] = []; mockFetch(t, async (url, init) => { calls.push({ url, init }); return init.method === "POST" ? json({ solicitudId: 7, estado: "CONVERTIDA", cliente: { id: 2, reutilizado: true }, mascota: { id: 4 } }, 201) : json({ ok: true }); });
  await petSolicitudesService.changeState(7, "CONTACTADA");
  const draft = conversionDraft(parsePetSolicitudes([solicitud])![0]);
  draft.responsable.telefono = "114"; draft.mascota.tipoPelo = "corto"; draft.mascota.observaciones = "nota";
  const result = await petSolicitudesService.convert(7, { ...draft, mascota: { ...draft.mascota, tipoPelo: draft.mascota.tipoPelo || null, observaciones: draft.mascota.observaciones || null } });
  assert.deepEqual(result, { solicitudId: 7, estado: "CONVERTIDA", cliente: { id: 2, reutilizado: true }, mascota: { id: 4 } });
  assert.equal(calls[0].init.method, "PATCH"); assert.deepEqual(JSON.parse(String(calls[0].init.body)), { estado: "CONTACTADA" });
  assert.equal(calls[1].init.method, "POST"); assert.equal((JSON.parse(String(calls[1].init.body)) as { mascota: { tipoPelo: string | null } }).mascota.tipoPelo, "corto");
  assert.equal(petSolicitudesMutationPolicy().retry, false);
});

test("códigos teléfono inválido, conflicto y no convertible quedan tipados", async t => {
  let code = "CLIENT_PHONE_INVALID"; mockFetch(t, async () => json({ error: code }, code === "CLIENT_PHONE_CONFLICT" ? 409 : 400));
  for (const expected of ["CLIENT_PHONE_INVALID", "CLIENT_PHONE_CONFLICT", "PET_SOLICITUD_NOT_CONVERTIBLE"]) { code = expected; await assert.rejects(petSolicitudesService.convert(7, { responsable: { nombre: "Ana", telefono: "x" }, mascota: { nombre: "F", raza: null, fechaNacimiento: null, tamano: null, sexo: null, tipoPelo: null, observaciones: null } }), error => error instanceof PetSolicitudesApiError && error.code === expected); }
});

test("detalle usa el elemento del listado y solo expone transiciones habilitadas", () => {
  const item = parsePetSolicitudes([solicitud])![0];
  assert.equal(item.responsable.telefonoSecundario, "113"); assert.equal(item.motivoContacto, "Baño");
  assert.deepEqual(petSolicitudActions("NUEVA"), { contactar: true, descartar: true, convertir: true });
  assert.deepEqual(petSolicitudActions("CONTACTADA"), { contactar: false, descartar: true, convertir: true });
  assert.deepEqual(petSolicitudActions("CONVERTIDA"), { contactar: false, descartar: false, convertir: false });
  assert.deepEqual(petSolicitudActions("DESCARTADA"), { contactar: false, descartar: false, convertir: false });
  assert.equal(parsePetSolicitudConversion({ solicitudId: 7, estado: "CONVERTIDA", cliente: { id: 2, reutilizado: false }, mascota: { id: 5 } })?.cliente.reutilizado, false);
});

test("namespace contiene localId/estado, Todas es null, estado vacío y tabs PET conservan UI", async t => {
  assert.deepEqual(queryKeys.petSolicitudes.list("L", null), ["pet-solicitudes", "L", null]);
  assert.deepEqual(petSolicitudesQuery("L", "NUEVA").queryKey, ["pet-solicitudes", "L", "NUEVA"]);
  assert.equal(petSolicitudesQuery("L", null).retry, false);
  assert.equal(getPetAdminContentKind("solicitudes"), "solicitudes"); assert.equal(getPetAdminContentKind("horarios"), "horarios"); assert.equal(getPetAdminContentKind("bloqueos"), "bloqueos"); assert.equal(getPetAdminContentKind("configuracion"), "configuracion");
  const client = new QueryClient(); t.after(() => client.clear()); const invalidated: unknown[][] = [];
  await invalidatePetSolicitudes({ invalidateQueries: async ({ queryKey }) => { invalidated.push([...queryKey]); } }, "L");
  assert.deepEqual(invalidated, [["pet-solicitudes", "L"]]);
});

test("write lock evita doble submit; guard compartido cubre dirty, busy e incertidumbre", () => {
  const lock = { current: false }; assert.equal(acquirePetSolicitudWriteLock(lock), true); assert.equal(acquirePetSolicitudWriteLock(lock), false); lock.current = false;
  let confirmations = 0; const dirty = createPetSolicitudesNavigationGuard({ dirty: true, busy: false, uncertain: false }, () => { confirmations++; return false; });
  assert.equal(dirty.hasPendingChanges(), true); assert.equal(dirty.canLeave(), false); assert.equal(confirmations, 1);
  const busy = createPetSolicitudesNavigationGuard({ dirty: false, busy: true, uncertain: false }, () => true); assert.equal(busy.canLeave(), false);
  const uncertain = createPetSolicitudesNavigationGuard({ dirty: false, busy: false, uncertain: true }, () => true); assert.equal(uncertain.hasPendingChanges(), true); assert.equal(uncertain.canLeave(), true);
});

test("error de red no implica replay: la verificación es GET autoritativo", async t => {
  const methods: string[] = []; mockFetch(t, async (_url, init) => { methods.push(String(init.method)); if (init.method === "PATCH") throw new TypeError("network"); return json([{ ...solicitud, estado: "CONTACTADA" }]); });
  await assert.rejects(petSolicitudesService.changeState(7, "CONTACTADA"));
  assert.deepEqual(await petSolicitudesService.list(null), [parsePetSolicitudes([{ ...solicitud, estado: "CONTACTADA" }])![0]]);
  assert.deepEqual(methods, ["PATCH", "GET"]);
});
