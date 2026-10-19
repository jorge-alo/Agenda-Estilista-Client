import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "../src/shared/lib/queryKeys.ts";
import type { PetAdminBookingAction } from "../src/feature/admin/petBooking/booking/petAdminBookingState.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); }
      catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
});

const storage = new Map<string, string>([["token", "ADMIN_JWT_TEST_SENTINEL"]]);
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => { storage.delete(key); },
    setItem: (key: string, value: string) => { storage.set(key, value); },
  },
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { href: "" } },
});

const {
  PetAdminBookingApiError,
  ordenarPetAdminExtraIds,
  petAdminBookingService,
} = await import("../src/feature/admin/petBooking/services/petAdminBooking.service.ts");

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(t: TestContext, handler: (url: string, init?: RequestInit) => Promise<Response>) {
  storage.set("token", "ADMIN_JWT_TEST_SENTINEL");
  t.mock.method(globalThis, "fetch", (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
}

function mascotaDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 6059,
    nombre: "Firulais",
    activo: 1,
    reserva_online_habilitada: 0,
    ...overrides,
  };
}

const input = {
  mascotaId: 6059,
  clienteId: 7001,
  servicioId: 2828,
  extraIds: [9596, 9595],
  fecha: "2026-10-20",
  hora: "09:30",
};

test("mascotas: GET exacto, JWT admin, signal y proyección; online=false no excluye", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response([mascotaDto(), mascotaDto({ id: 6060, activo: 0, reserva_online_habilitada: 0 })]);
  });

  const result = await petAdminBookingService.listarMascotas({ signal });
  assert.equal(request?.url, "/api/pet/admin/mascotas");
  assert.equal(request?.init?.method, "GET");
  assert.deepEqual(request?.init?.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer ADMIN_JWT_TEST_SENTINEL",
  });
  assert.equal(request?.init?.signal, signal);
  assert.equal(request?.init?.cache, "no-store");
  assert.deepEqual(result, [
    { id: 6059, nombre: "Firulais", activo: true, reservaOnlineHabilitada: false },
    { id: 6060, nombre: "Firulais", activo: false, reservaOnlineHabilitada: false },
  ]);
});

test("mascotas: response inválida produce error de protocolo", async t => {
  mockFetch(t, async () => response([{ ...mascotaDto(), activo: true }]));
  await assert.rejects(petAdminBookingService.listarMascotas(), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 200);
    assert.equal(error.code, null);
    return true;
  });
});

test("lecturas propagan AbortSignal sin convertir AbortError en error HTTP", async t => {
  const controller = new AbortController();
  controller.abort();
  const abort = new DOMException("Aborted", "AbortError");
  mockFetch(t, async () => { throw abort; });
  await assert.rejects(petAdminBookingService.listarMascotas({ signal: controller.signal }), error => error === abort);
});

test("detalle mascota: ID en path, responsables existentes proyectados y signal", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response({ ...mascotaDto(), responsables: [{ id: 7001, nombre: "Ana", telefono: "+541123456789", local_id: 5532, created_at: "ignored" }] });
  });
  const result = await petAdminBookingService.obtenerMascota(6059, { signal });
  assert.equal(request?.url, "/api/pet/admin/mascotas/6059");
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(result, {
    id: 6059,
    nombre: "Firulais",
    activo: true,
    reservaOnlineHabilitada: false,
    responsables: [{ clienteId: 7001, nombre: "Ana", telefono: "+541123456789" }],
  });
});

test("detalle mascota: shape de responsables inválido no se acepta", async t => {
  mockFetch(t, async () => response({ ...mascotaDto(), responsables: [{ id: 7001, nombre: "Ana" }] }));
  await assert.rejects(petAdminBookingService.obtenerMascota(6059), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 200);
    return true;
  });
});

test("servicios configurados: usa bridge por mascota y duración PET, mapea activo", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response([{ id: 2828, nombre: "Baño y corte", activo: 1, duracion_minutos: 90 }]);
  });
  const result = await petAdminBookingService.listarServicios(6059, { signal });
  assert.equal(request?.url, "/api/pet/admin/mascotas/6059/servicios");
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(result, [{ id: 2828, nombre: "Baño y corte", activo: true, duracionMinutos: 90 }]);
});

test("servicios configurados: shape inválido se rechaza", async t => {
  mockFetch(t, async () => response([{ id: 2828, nombre: "Baño", activo: 1, duracion: 60 }]));
  await assert.rejects(petAdminBookingService.listarServicios(6059), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 200);
    return true;
  });
});

test("servicio con activo SQL NULL no se marca utilizable", async t => {
  mockFetch(t, async () => response([{ id: 2828, nombre: "Baño", activo: null, duracion_minutos: 90 }]));
  assert.deepEqual(await petAdminBookingService.listarServicios(6059), [
    { id: 2828, nombre: "Baño", activo: false, duracionMinutos: 90 },
  ]);
});

test("extras configurados: endpoint por mascota, duración PET y activos/inactivos", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response([
      { id: 9595, nombre: "Corte de uñas", activo: 1, duracion_minutos: 15 },
      { id: 9596, nombre: "Deslanado extra", activo: 0, duracion_minutos: 25 },
    ]);
  });
  const result = await petAdminBookingService.listarExtras(6059, { signal });
  assert.equal(request?.url, "/api/pet/admin/mascotas/6059/extras");
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(result, [
    { id: 9595, nombre: "Corte de uñas", activo: true, duracionMinutos: 15 },
    { id: 9596, nombre: "Deslanado extra", activo: false, duracionMinutos: 25 },
  ]);
});

test("extras configurados: shape inválido se rechaza", async t => {
  mockFetch(t, async () => response([{ id: 9595, nombre: "Corte de uñas", activo: 1, duracion_extra_minutos: 15 }]));
  await assert.rejects(petAdminBookingService.listarExtras(6059), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 200);
    return true;
  });
});

test("disponibilidad: query exacta, extraIds repetidos ASC, JWT y signal", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response({ fecha: input.fecha, duracionMinutos: 130, slots: [{ horaInicio: "09:30", horaFin: "11:40" }] });
  });
  const result = await petAdminBookingService.obtenerDisponibilidad({
    mascotaId: 6059,
    servicioId: 2828,
    fecha: input.fecha,
    extraIds: input.extraIds,
  }, { signal });
  const url = new URL(request?.url ?? "", "http://localhost");
  assert.equal(url.pathname, "/api/pet/admin/disponibilidad");
  assert.deepEqual([...url.searchParams.keys()], ["mascotaId", "servicioId", "fecha", "extraIds", "extraIds"]);
  assert.deepEqual(url.searchParams.getAll("extraIds"), ["9595", "9596"]);
  assert.equal(url.searchParams.get("mascotaId"), "6059");
  assert.equal(url.searchParams.get("servicioId"), "2828");
  assert.equal(url.searchParams.get("fecha"), input.fecha);
  assert.equal(url.searchParams.has("clienteId"), false);
  assert.equal(url.searchParams.has("estilistaId"), false);
  assert.equal(url.searchParams.has("duracion"), false);
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(result, { fecha: input.fecha, duracionMinutos: 130, slots: [{ horaInicio: "09:30", horaFin: "11:40" }] });
});

test("disponibilidad: extraIds vacío se omite y slots inválidos se rechazan", async t => {
  let url = "";
  mockFetch(t, async requestUrl => {
    url = requestUrl;
    return response({ fecha: input.fecha, duracionMinutos: 90, slots: [] });
  });
  const result = await petAdminBookingService.obtenerDisponibilidad({
    mascotaId: 6059, servicioId: 2828, fecha: input.fecha, extraIds: [],
  });
  assert.equal(new URL(url, "http://localhost").searchParams.has("extraIds"), false);
  assert.deepEqual(result.slots, []);

  mockFetch(t, async () => response({ fecha: input.fecha, duracionMinutos: 90, slots: [{ horaInicio: "99:00", horaFin: "10:00" }] }));
  await assert.rejects(petAdminBookingService.obtenerDisponibilidad({
    mascotaId: 6059, servicioId: 2828, fecha: input.fecha, extraIds: [],
  }), error => error instanceof PetAdminBookingApiError && error.status === 200);
});

test("disponibilidad: conserva status y code reales del backend PET admin", async t => {
  mockFetch(t, async () => response({ error: "mensaje interno ignorado", code: "PET_HIGH_DEMAND_SETTINGS_REQUIRED" }, 409));
  await assert.rejects(petAdminBookingService.obtenerDisponibilidad({
    mascotaId: 6059, servicioId: 2828, fecha: input.fecha, extraIds: [],
  }), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "PET_HIGH_DEMAND_SETTINGS_REQUIRED");
    assert.equal(error.message, "PET_ADMIN_BOOKING_API_ERROR");
    return true;
  });
});

test("errores de disponibilidad admin conservan status y los códigos documentados", async t => {
  for (const [status, code] of [
    [400, "PET_AVAILABILITY_INVALID_QUERY"],
    [404, "PET_MASCOTA_NOT_FOUND"],
    [409, "PET_MASCOTA_INACTIVA"],
    [409, "PET_SERVICIO_INACTIVO"],
    [409, "PET_SERVICIO_NO_ASOCIADO"],
    [404, "PET_EXTRA_NOT_FOUND"],
    [409, "PET_EXTRA_INACTIVO"],
    [409, "PET_EXTRA_NO_ASOCIADO"],
    [409, "PET_HIGH_DEMAND_SETTINGS_REQUIRED"],
    [500, "PET_AVAILABILITY_INTEGRITY_ERROR"],
    [500, "PET_AVAILABILITY_ERROR"],
    [401, null],
  ] as const) {
    mockFetch(t, async () => response({ error: "detalle interno no expuesto", code }, status));
    await assert.rejects(petAdminBookingService.obtenerDisponibilidad({
      mascotaId: 6059, servicioId: 2828, fecha: input.fecha, extraIds: [],
    }), error => {
      assert.ok(error instanceof PetAdminBookingApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.message, "PET_ADMIN_BOOKING_API_ERROR");
      return true;
    });
  }
});

test("crear: body exacto de seis campos, extras ASC en copia, JWT y response 201 validada", async t => {
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response({
      id: 123,
      fecha: input.fecha,
      hora: input.hora,
      horaFin: "11:40",
      estado: "activo",
      mascotaId: 6059,
      clienteId: 7001,
      servicioId: 2828,
      precio: 1,
      localId: 5532,
    }, 201);
  });
  const originalExtraIds = [...input.extraIds];
  const result = await petAdminBookingService.crearTurno(input);
  assert.equal(request?.url, "/api/pet/admin/turnos");
  assert.equal(request?.init?.method, "POST");
  const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body), ["mascotaId", "clienteId", "servicioId", "extraIds", "fecha", "hora"]);
  assert.deepEqual(body, {
    mascotaId: 6059,
    clienteId: 7001,
    servicioId: 2828,
    extraIds: [9595, 9596],
    fecha: input.fecha,
    hora: input.hora,
  });
  for (const forbidden of ["localId", "estilistaId", "estilista_id", "cliente_nombre", "cliente_telefono", "duracion", "horaFin", "precio", "altaExigencia"]) {
    assert.equal(forbidden in body, false);
  }
  assert.deepEqual(input.extraIds, originalExtraIds, "no muta input");
  assert.equal(request?.init?.signal, undefined);
  assert.deepEqual(result, {
    id: 123, fecha: input.fecha, hora: input.hora, horaFin: "11:40", estado: "activo",
    mascotaId: 6059, clienteId: 7001, servicioId: 2828,
  });
});

test("crear: 201 con shape inválido se rechaza; HTTP PET admin preserva status/code", async t => {
  mockFetch(t, async () => response({ id: 123 }, 201));
  await assert.rejects(petAdminBookingService.crearTurno(input), error =>
    error instanceof PetAdminBookingApiError && error.status === 201 && error.code === null);

  mockFetch(t, async () => response({ error: "interno", code: "PET_RESPONSABLE_NO_ASOCIADO" }, 409));
  await assert.rejects(petAdminBookingService.crearTurno(input), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "PET_RESPONSABLE_NO_ASOCIADO");
    assert.equal(error.message, "PET_ADMIN_BOOKING_API_ERROR");
    return true;
  });

  mockFetch(t, async () => response({ error: "No autorizado" }, 403));
  await assert.rejects(petAdminBookingService.crearTurno(input), error =>
    error instanceof PetAdminBookingApiError && error.status === 403 && error.code === null);
});

test("creación administra errores reales de validación, mascota, responsable, servicio y slot", async t => {
  for (const [status, code] of [
    [400, "PET_TURNO_INVALID_BODY"],
    [403, "PET_LOCAL_REQUIRED"],
    [404, "PET_MASCOTA_NOT_FOUND"],
    [409, "PET_MASCOTA_INACTIVA"],
    [404, "PET_CLIENTE_NOT_FOUND"],
    [409, "PET_RESPONSABLE_NO_ASOCIADO"],
    [404, "PET_SERVICIO_NOT_FOUND"],
    [409, "PET_SERVICIO_INACTIVO"],
    [409, "PET_SERVICIO_NO_ASOCIADO"],
    [404, "PET_EXTRA_NOT_FOUND"],
    [409, "PET_EXTRA_INACTIVO"],
    [409, "PET_EXTRA_NO_ASOCIADO"],
    [409, "PET_SLOT_UNAVAILABLE"],
    [409, "PET_HIGH_DEMAND_SETTINGS_REQUIRED"],
    [500, null],
    [401, null],
  ] as const) {
    mockFetch(t, async () => response({ error: "detalle interno no expuesto", ...(code ? { code } : {}) }, status));
    await assert.rejects(petAdminBookingService.crearTurno(input), error => {
      assert.ok(error instanceof PetAdminBookingApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.equal(error.message, "PET_ADMIN_BOOKING_API_ERROR");
      return true;
    });
  }
});

test("fetchWithAuth: 401 usa invalidación/redirección admin existente y error tipado", async t => {
  storage.set("token", "ADMIN_JWT_TEST_SENTINEL");
  mockFetch(t, async () => response({ error: "No autorizado" }, 401));
  await assert.rejects(petAdminBookingService.listarMascotas(), error =>
    error instanceof PetAdminBookingApiError && error.status === 401 && error.code === null);
  assert.equal(storage.has("token"), false);
  assert.equal((globalThis.window as { location: { href: string } }).location.href, "/login");
});

test("ordenarPetAdminExtraIds produce copia ASC", () => {
  const original = [9596, 9595];
  const sorted = ordenarPetAdminExtraIds(original);
  assert.deepEqual(sorted, [9595, 9596]);
  assert.notEqual(sorted, original);
  assert.deepEqual(original, [9596, 9595]);
});

const {
  petAdminBookingReducer: adminReducer, petAdminInitialState, petAdminSelectionKey,
  petAdminSelectableMascotas, petAdminUsableOptions, petAdminSuccessSnapshot, petAdminValidDate,
} = await import("../src/feature/admin/petBooking/booking/petAdminBookingState.ts");
const {
  petAdminMascotasQuery, petAdminDetailQuery, petAdminServiciosQuery, petAdminExtrasQuery,
  petAdminAvailabilityQuery, petAdminCreationMutation, petAdminBookingErrorKind,
} = await import("../src/feature/admin/petBooking/booking/petAdminBookingQueries.ts");
const { createPetAdminBookingController } = await import("../src/feature/admin/petBooking/booking/petAdminBookingController.ts");

type AdminController = ReturnType<typeof createPetAdminBookingController>;
type AdminSnapshot = ReturnType<AdminController["getSnapshot"]>;
const pet = { id: 6059, nombre: "Firulais", activo: true, reservaOnlineHabilitada: false };
const responsible = { clienteId: 7001, nombre: "Ana", telefono: "+541123456789" };
const configuredServices = [
  { id: 2828, nombre: "Baño y corte", activo: true, duracionMinutos: 90 },
  { id: 2830, nombre: "Otro servicio", activo: true, duracionMinutos: 60 },
  { id: 2827, nombre: "Baño inactivo", activo: false, duracionMinutos: 60 },
];
const configuredExtras = [
  { id: 9595, nombre: "Corte de uñas", activo: true, duracionMinutos: 15 },
  { id: 9596, nombre: "Deslanado extra", activo: true, duracionMinutos: 25 },
  { id: 9597, nombre: "Extra inactivo", activo: false, duracionMinutos: 10 },
];
const adminAvailability = { fecha: input.fecha, duracionMinutos: 130, slots: [{ horaInicio: "09:30", horaFin: "11:40" }] };

function adminDraftState() {
  let state = petAdminInitialState();
  for (const action of [
    { type: "SET_MASCOTA", mascotaId: 6059 }, { type: "SET_CLIENTE", clienteId: 7001 },
    { type: "SET_SERVICIO", servicioId: 2828 }, { type: "TOGGLE_EXTRA", extraId: 9596 },
    { type: "TOGGLE_EXTRA", extraId: 9595 }, { type: "SET_FECHA", fecha: input.fecha },
  ] satisfies PetAdminBookingAction[]) state = adminReducer(state, action);
  return adminReducer(state, { type: "SET_SLOT", slot: { ...adminAvailability.slots[0], selectionKey: petAdminSelectionKey(state.draft) } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function waitAdmin(controller: AdminController, predicate: (value: AdminSnapshot) => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate(controller.getSnapshot())) return;
    await nextTick();
  }
  assert.fail(`ADMIN_WAIT_TIMEOUT: ${JSON.stringify({ draft: controller.getSnapshot().state.draft, issue: controller.getSnapshot().issue })}`);
}

function adminClient(t: TestContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  t.after(() => client.clear());
  return client;
}

function adminController(t: TestContext, client = adminClient(t)) {
  const controller = createPetAdminBookingController(client);
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => { unsubscribe(); controller.dispose(); });
  return controller;
}

function servicesDto() { return configuredServices.map(item => ({ id: item.id, nombre: item.nombre, activo: Number(item.activo), duracion_minutos: item.duracionMinutos })); }
function extrasDto() { return configuredExtras.map(item => ({ id: item.id, nombre: item.nombre, activo: Number(item.activo), duracion_minutos: item.duracionMinutos })); }
function detailDto(id = 6059) {
  return { ...mascotaDto({ id, nombre: id === 6059 ? "Firulais" : "Luna" }),
    responsables: [{ id: id === 6059 ? 7001 : 7002, nombre: "Ana", telefono: responsible.telefono }] };
}
function defaultAdminResponse(url: string, init?: RequestInit): Response {
  if (url.endsWith("/mascotas")) return response([mascotaDto(), mascotaDto({ id: 6060, nombre: "Luna" }), mascotaDto({ id: 6061, activo: 0 })]);
  if (url.endsWith("/servicios")) return response(servicesDto());
  if (url.endsWith("/extras")) return response(extrasDto());
  if (url.includes("/disponibilidad?")) return response({ ...adminAvailability, fecha: new URL(url, "http://localhost").searchParams.get("fecha") });
  if (url.endsWith("/turnos")) {
    const command = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return response({ id: 123, estado: "activo", horaFin: "11:40", ...command }, 201);
  }
  const id = Number(url.split("/").at(-1));
  assert.ok([6059, 6060].includes(id), `unexpected request: ${url}`);
  return response(detailDto(id));
}

async function chooseAdminPet(controller: AdminController) {
  await waitAdmin(controller, value => value.queries.mascotas.isSuccess && !value.queries.mascotas.isFetching);
  controller.setMascota(6059);
  await waitAdmin(controller, value => value.queries.detail.isSuccess && !value.queries.detail.isFetching
    && value.queries.servicios.isSuccess && !value.queries.servicios.isFetching && value.queries.extras.isSuccess && !value.queries.extras.isFetching);
}
async function readyAdmin(controller: AdminController) {
  await chooseAdminPet(controller);
  controller.setServicio(2828);
  controller.toggleExtra(9596);
  controller.toggleExtra(9595);
  controller.setFecha(input.fecha);
  await waitAdmin(controller, value => value.availability.isSuccess && !value.availability.isFetching);
  controller.setSlot({ ...adminAvailability.slots[0], selectionKey: petAdminSelectionKey(controller.getSnapshot().state.draft) });
  assert.equal(controller.getSnapshot().canConfirm, true);
}

test("admin estado inicial vacío y mascotas activas: online=false es elegible; sin autoselección", () => {
  assert.deepEqual(petAdminInitialState(), { draft: { mascotaId: null, clienteId: null, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null }, success: null });
  assert.deepEqual(petAdminSelectableMascotas([]), []);
  assert.deepEqual(petAdminSelectableMascotas([pet, { ...pet, id: 2, activo: false }]), [pet]);
  assert.equal(adminReducer(petAdminInitialState(), { type: "RECONCILE_MASCOTAS", mascotas: [pet] }).draft.mascotaId, null);
  assert.equal(petAdminValidDate("2026-02-30"), false);
});

test("admin reducer: mascota resetea todo; responsable conserva slot/disponibilidad; servicio conserva extras", () => {
  const state = adminDraftState();
  const before = structuredClone(state);
  const differentPet = adminReducer(state, { type: "SET_MASCOTA", mascotaId: 6060 });
  assert.deepEqual(differentPet.draft, { ...petAdminInitialState().draft, mascotaId: 6060 });
  const differentClient = adminReducer(state, { type: "SET_CLIENTE", clienteId: 7002 });
  assert.deepEqual(differentClient.draft, { ...state.draft, clienteId: 7002 });
  assert.equal(petAdminSelectionKey(state.draft), petAdminSelectionKey(differentClient.draft));
  const service = adminReducer(state, { type: "SET_SERVICIO", servicioId: 2830 });
  assert.deepEqual(service.draft, { ...state.draft, servicioId: 2830, slotSeleccionado: null });
  assert.equal(adminReducer(state, { type: "SET_FECHA", fecha: "2026-10-21" }).draft.slotSeleccionado, null);
  assert.deepEqual(state, before);
});

test("admin responsables: 0/1/varios iniciales y reconciliación nunca reemplaza ni preselecciona", () => {
  const state = adminReducer(petAdminInitialState(), { type: "SET_MASCOTA", mascotaId: 6059 });
  const reconcile = (responsables: typeof responsible[], initial: boolean, base = state) =>
    adminReducer(base, { type: "RECONCILE_DETAIL", detail: { ...pet, responsables }, initial });
  assert.equal(reconcile([], true).draft.clienteId, null);
  const selected = reconcile([responsible], true);
  assert.equal(selected.draft.clienteId, 7001);
  assert.equal(reconcile([responsible, { ...responsible, clienteId: 7002 }], true).draft.clienteId, null);
  assert.equal(reconcile([{ ...responsible, clienteId: 7002 }], false, selected).draft.clienteId, null);
  assert.equal(reconcile([responsible], false).draft.clienteId, null);
});

test("admin catálogos: filtra inactivos, extras únicos ASC y resets conservadores", () => {
  const state = adminDraftState();
  assert.deepEqual(petAdminUsableOptions(configuredServices).map(item => item.id), [2828, 2830]);
  assert.deepEqual(state.draft.extraIds, [9595, 9596]);
  const toggled = adminReducer(state, { type: "TOGGLE_EXTRA", extraId: 9595 });
  assert.deepEqual(toggled.draft.extraIds, [9596]);
  assert.equal(toggled.draft.slotSeleccionado, null);
  const removedService = adminReducer(state, { type: "RECONCILE_SERVICIOS", servicios: [configuredServices[1]] });
  assert.equal(removedService.draft.servicioId, null);
  assert.equal(removedService.draft.slotSeleccionado, null);
  assert.deepEqual(removedService.draft.extraIds, [9595, 9596]);
  const removedExtra = adminReducer(state, { type: "RECONCILE_EXTRAS", extras: [configuredExtras[0]] });
  assert.deepEqual(removedExtra.draft.extraIds, [9595]);
  assert.equal(removedExtra.draft.slotSeleccionado, null);
  assert.deepEqual(adminReducer(state, { type: "RECONCILE_MASCOTAS", mascotas: [] }), petAdminInitialState());
});

test("admin selectionKey: ASC determinista, sin responsable/PII; slot viejo rechazado", () => {
  const state = adminDraftState();
  assert.equal(petAdminSelectionKey(state.draft), petAdminSelectionKey({ ...state.draft, extraIds: [9596, 9595] }));
  assert.equal(petAdminSelectionKey(state.draft).includes("7001"), false);
  const next = adminReducer(state, { type: "SET_FECHA", fecha: "2026-10-21" });
  assert.equal(adminReducer(next, { type: "SET_SLOT", slot: state.draft.slotSeleccionado! }).draft.slotSeleccionado, null);
});

test("admin queries: namespace separado, enabled, política de lectura y mutation sin retry", () => {
  const queries = [petAdminMascotasQuery(), petAdminDetailQuery(6059), petAdminServiciosQuery(6059), petAdminExtrasQuery(6059), petAdminAvailabilityQuery(input)];
  for (const query of queries) {
    assert.equal(query.queryKey[0], "pet-admin-booking");
    assert.equal(query.retry, false);
    assert.equal(query.staleTime, 0);
    assert.equal(query.gcTime, 0);
    assert.equal(query.refetchOnWindowFocus, false);
    assert.equal(query.refetchOnReconnect, false);
    assert.equal(query.placeholderData, undefined);
    assert.equal(JSON.stringify(query.queryKey).includes("ADMIN_JWT"), false);
  }
  assert.notDeepEqual(queryKeys.petAdminBooking.mascotas(), queryKeys.petBooking.options("x", "s", 6059));
  assert.notDeepEqual(petAdminAvailabilityQuery(input).queryKey, queryKeys.disponibilidad.admin(input.fecha, 1, 2));
  assert.equal(petAdminDetailQuery(null).enabled, false);
  assert.equal(petAdminAvailabilityQuery({ ...input, extraIds: [] }).enabled, true);
  assert.equal(petAdminAvailabilityQuery({ ...input, fecha: "" }).enabled, false);
  assert.equal(petAdminAvailabilityQuery({ ...input, mascotaId: 0 }).enabled, false);
  assert.equal(petAdminAvailabilityQuery({ ...input, extraIds: [9595, 9595] }).enabled, false);
  assert.equal(petAdminCreationMutation().retry, false);
});

test("admin controller: dependencias por mascota, no selecciona inactivos y no exige responsable para slots", async t => {
  const requests: string[] = [];
  mockFetch(t, async (url, init) => { requests.push(url); return defaultAdminResponse(url, init); });
  const controller = adminController(t);
  await chooseAdminPet(controller);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7001);
  assert.equal(controller.getSnapshot().state.draft.servicioId, null);
  assert.deepEqual(controller.getSnapshot().mascotas.map(item => item.id), [6059, 6060]);
  assert.deepEqual(controller.getSnapshot().servicios.map(item => item.id), [2828, 2830]);
  assert.deepEqual(controller.getSnapshot().extras.map(item => item.id), [9595, 9596]);
  controller.setMascota(6061);
  controller.setServicio(2827);
  controller.toggleExtra(9597);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, 6059);
  assert.equal(controller.getSnapshot().state.draft.servicioId, null);
  assert.deepEqual(controller.getSnapshot().state.draft.extraIds, []);
  controller.setCliente(null);
  controller.setServicio(2828);
  controller.setFecha(input.fecha);
  await waitAdmin(controller, value => value.availability.isSuccess && !value.availability.isFetching);
  controller.setSlot({ ...adminAvailability.slots[0], selectionKey: petAdminSelectionKey(controller.getSnapshot().state.draft) });
  assert.equal(controller.getSnapshot().canConfirm, false);
  assert.equal(await controller.confirmar(), "ignored");
  const slot = controller.getSnapshot().state.draft.slotSeleccionado;
  const readsBefore = requests.length;
  controller.setCliente(7001);
  assert.deepEqual(controller.getSnapshot().state.draft.slotSeleccionado, slot);
  assert.equal(controller.getSnapshot().canConfirm, true);
  await nextTick();
  assert.equal(requests.length, readsBefore, "responsable no altera query de disponibilidad");
  assert.ok(requests.includes("/api/pet/admin/mascotas/6059"));
  assert.ok(requests.includes("/api/pet/admin/mascotas/6059/servicios"));
  assert.ok(requests.includes("/api/pet/admin/mascotas/6059/extras"));
});

test("admin mascotas remotas: cero o una no autoseleccionan, online=false sigue disponible", async t => {
  for (const items of [[], [mascotaDto()]]) {
    mockFetch(t, async (url, init) => url.endsWith("/mascotas") ? response(items) : defaultAdminResponse(url, init));
    const controller = adminController(t);
    await waitAdmin(controller, value => value.queries.mascotas.isSuccess);
    assert.equal(controller.getSnapshot().state.draft.mascotaId, null);
    assert.equal(controller.getSnapshot().mascotas.length, items.length);
    assert.equal(controller.getSnapshot().canConfirm, false);
    controller.dispose();
  }
});

test("admin detalle inicial 0/varios responsables: refresh posterior de uno NO autoselecciona", async t => {
  for (const count of [0, 2]) {
    let detailCalls = 0;
    mockFetch(t, async (url, init) => {
      if (url === "/api/pet/admin/mascotas/6059") {
        detailCalls++;
        const responsables = detailCalls === 1
          ? Array.from({ length: count }, (_, i) => ({ id: 7001 + i, nombre: "Ana", telefono: responsible.telefono }))
          : detailDto().responsables;
        return response({ ...mascotaDto(), responsables });
      }
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await chooseAdminPet(controller);
    assert.equal(controller.getSnapshot().state.draft.clienteId, null);
    await controller.refetchDetail();
    assert.equal(controller.getSnapshot().state.draft.clienteId, null);
    controller.dispose();
  }
});

test("admin out-of-order: detalle/servicios/extras A se abortan y respuestas tardías no repueblan B", async t => {
  const pending = { detail: deferred<Response>(), servicios: deferred<Response>(), extras: deferred<Response>() };
  const signals: AbortSignal[] = [];
  mockFetch(t, async (url, init) => {
    if (url.startsWith("/api/pet/admin/mascotas/6059")) {
      assert.ok(init?.signal);
      signals.push(init.signal);
      return url.endsWith("/servicios") ? pending.servicios.promise : url.endsWith("/extras") ? pending.extras.promise : pending.detail.promise;
    }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await waitAdmin(controller, value => value.queries.mascotas.isSuccess);
  controller.setMascota(6059);
  await waitAdmin(controller, () => signals.length === 3);
  controller.setMascota(6060);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(controller.getSnapshot().queries.detail.data, undefined);
  assert.deepEqual(controller.getSnapshot().servicios, []);
  assert.deepEqual(controller.getSnapshot().extras, []);
  await waitAdmin(controller, value => value.queries.detail.isSuccess && value.queries.servicios.isSuccess && value.queries.extras.isSuccess);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7002);
  pending.detail.resolve(response(detailDto()));
  pending.servicios.resolve(response([{ id: 999, nombre: "viejo A", activo: 1, duracion_minutos: 10 }]));
  pending.extras.resolve(response([{ id: 999, nombre: "viejo A", activo: 1, duracion_minutos: 10 }]));
  await nextTick(); await nextTick();
  assert.equal(controller.getSnapshot().queries.detail.data?.id, 6060);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7002);
  assert.ok(!controller.getSnapshot().servicios.some(item => item.id === 999));
  assert.ok(!controller.getSnapshot().extras.some(item => item.id === 999));
});

test("admin disponibilidad A/B: cancela A, no placeholder y B gana aunque A resuelva tarde", async t => {
  const pending = deferred<Response>();
  let oldSignal: AbortSignal | null = null;
  mockFetch(t, async (url, init) => {
    if (url.includes("/disponibilidad?") && new URL(url, "http://localhost").searchParams.get("fecha") === input.fecha) {
      oldSignal = init?.signal ?? null;
      return pending.promise;
    }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await chooseAdminPet(controller);
  controller.setServicio(2828);
  controller.setFecha(input.fecha);
  await waitAdmin(controller, () => oldSignal !== null);
  controller.setFecha("2026-10-21");
  assert.equal((oldSignal as AbortSignal | null)?.aborted, true);
  assert.equal(controller.getSnapshot().availability.data, undefined);
  assert.equal(controller.getSnapshot().state.draft.slotSeleccionado, null);
  await waitAdmin(controller, value => value.availability.isSuccess);
  pending.resolve(response(adminAvailability));
  await nextTick(); await nextTick();
  assert.equal(controller.getSnapshot().availability.data?.fecha, "2026-10-21");
});

test("admin creación: doble submit un POST, snapshot inmutable e invalidaciones solo PET incluida selección exacta", async t => {
  const pending = deferred<Response>();
  const posted = deferred<void>();
  let posts = 0;
  let body: Record<string, unknown> | undefined;
  mockFetch(t, async (url, init) => {
    if (url.endsWith("/turnos")) { posts++; body = JSON.parse(String(init?.body)); posted.resolve(); return pending.promise; }
    return defaultAdminResponse(url, init);
  });
  const client = adminClient(t);
  client.setQueryData(queryKeys.petTurnos.fecha(input.fecha), []);
  client.setQueryData(queryKeys.petTurnoDisponibilidad.turnoFecha(99, input.fecha), adminAvailability);
  const otherPetAvailability = queryKeys.petAdminBooking.availability(6060, 2828, [], input.fecha);
  client.setQueryData(otherPetAvailability, adminAvailability);
  client.setQueryData(queryKeys.turnos.lista(input.fecha), []);
  client.setQueryData(queryKeys.disponibilidad.admin(input.fecha, 1, 2), {});
  const controller = adminController(t, client);
  await readyAdmin(controller);
  const exactKey = petAdminAvailabilityQuery(input).queryKey;
  const first = controller.confirmar();
  const second = controller.confirmar();
  assert.equal(await second, "ignored");
  await posted.promise;
  assert.equal(controller.getSnapshot().isSubmitting, true);
  assert.deepEqual(body, { mascotaId: 6059, servicioId: 2828, extraIds: [9595, 9596], fecha: input.fecha, clienteId: 7001, hora: "09:30" });
  client.setQueryData(queryKeys.petAdminBooking.mascotaDetail(6059), { ...pet, responsables: [{ ...responsible, nombre: "Modificado" }] });
  client.setQueryData(queryKeys.petAdminBooking.servicios(6059), configuredServices.map(item => ({ ...item, nombre: "Modificado" })));
  client.setQueryData(queryKeys.petAdminBooking.extras(6059), configuredExtras.map(item => ({ ...item, nombre: "Modificado" })));
  controller.setMascota(6060);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, 6059, "selección bloqueada durante submit");
  pending.resolve(response({ id: 123, ...body, horaFin: "11:40", estado: "activo" }, 201));
  assert.equal(await first, "created");
  const success = controller.getSnapshot().state.success;
  assert.ok(success);
  assert.equal(success.responsableNombre, "Ana");
  assert.equal(success.servicioNombre, "Baño y corte");
  assert.deepEqual(success.extras.map(item => item.nombre), ["Corte de uñas", "Deslanado extra"]);
  assert.ok(Object.isFrozen(success) && Object.isFrozen(success.extras) && Object.isFrozen(success.extras[0]));
  assert.equal(success.hora, "09:30");
  assert.equal(success.horaFin, "11:40");
  assert.equal(success.duracionMinutos, 130);
  assert.equal(controller.getSnapshot().canConfirm, false);
  assert.equal(client.getQueryState(queryKeys.petTurnos.fecha(input.fecha))?.isInvalidated, true);
  assert.equal(client.getQueryState(queryKeys.petTurnoDisponibilidad.turnoFecha(99, input.fecha))?.isInvalidated, true);
  assert.equal(client.getQueryState(exactKey)?.isInvalidated, true);
  assert.equal(client.getQueryState(otherPetAvailability)?.isInvalidated, true, "equipo compartido: disponibilidad de otra mascota también queda stale");
  assert.equal(client.getQueryState(queryKeys.turnos.lista(input.fecha))?.isInvalidated, false);
  assert.equal(client.getQueryState(queryKeys.disponibilidad.admin(input.fecha, 1, 2))?.isInvalidated, false);
  assert.equal(posts, 1);
  controller.startNewBooking();
  assert.deepEqual(controller.getSnapshot().state, petAdminInitialState());
});

test("admin snapshot puro valida selección vigente y copia nombres/extras sin response remota", () => {
  const state = adminDraftState();
  const base = petAdminSuccessSnapshot(state.draft, [pet], { ...pet, responsables: [responsible] }, configuredServices, configuredExtras, adminAvailability);
  assert.ok(base);
  assert.equal(base.responsableTelefono, responsible.telefono);
  assert.equal("mascotas" in state, false);
  assert.equal(petAdminSuccessSnapshot({ ...state.draft, clienteId: null }, [pet], { ...pet, responsables: [responsible] }, configuredServices, configuredExtras, adminAvailability), null);
});

for (const [code, status, target] of [
  ["PET_SLOT_UNAVAILABLE", 409, "availability"],
  ["PET_SERVICIO_INACTIVO", 409, "servicios"],
  ["PET_EXTRA_NO_ASOCIADO", 409, "extras"],
  ["PET_RESPONSABLE_NO_ASOCIADO", 409, "detail"],
  ["PET_MASCOTA_INACTIVA", 409, "mascotas"],
] as const) {
  test(`admin creación ${code}: recovery una vez, reconciliación conservadora y sin segundo POST`, async t => {
    let posts = 0;
    let recoveredReads = 0;
    let recovering = false;
    const availabilityUrls: string[] = [];
    mockFetch(t, async (url, init) => {
      if (url.includes("/disponibilidad?")) availabilityUrls.push(url);
      if (url.endsWith("/turnos")) { posts++; recovering = true; return response({ error: "interno", code }, status); }
      if (recovering) {
        const match = target === "availability" ? url.includes("/disponibilidad?")
          : target === "detail" ? url.endsWith("/mascotas/6059") : url.endsWith(`/${target}`);
        if (match) {
          recoveredReads++;
          if (target === "servicios") return response(servicesDto().filter(item => item.id !== 2828));
          if (target === "extras") return response(extrasDto().filter(item => item.id !== 9596));
          if (target === "detail") return response({ ...detailDto(), responsables: [{ id: 7002, nombre: "Otra", telefono: responsible.telefono }] });
          if (target === "mascotas") return response([mascotaDto({ id: 6060 })]);
          return response(adminAvailability);
        }
      }
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await readyAdmin(controller);
    const before = structuredClone(controller.getSnapshot().state.draft);
    assert.equal(await controller.confirmar(), "error");
    await waitAdmin(controller, value => !value.isRecovering && recoveredReads === 1);
    const after = controller.getSnapshot().state.draft;
    if (target === "mascotas") assert.deepEqual(after, petAdminInitialState().draft);
    else {
      assert.equal(after.mascotaId, before.mascotaId);
      assert.equal(after.fecha, before.fecha);
      assert.equal(after.clienteId, target === "detail" ? null : before.clienteId);
      assert.equal(after.servicioId, target === "servicios" ? null : before.servicioId);
      assert.deepEqual(after.extraIds, target === "extras" ? [9595] : before.extraIds);
      assert.deepEqual(after.slotSeleccionado, target === "detail" ? before.slotSeleccionado : null);
    }
    assert.equal(controller.getSnapshot().canConfirm, false);
    await nextTick(); await nextTick();
    assert.equal(recoveredReads, 1);
    assert.equal(posts, 1);
    if (target === "availability") {
      assert.equal(availabilityUrls.length, 2);
      assert.equal(availabilityUrls[1], availabilityUrls[0], "refetch de la selección exacta que falló, no otra fecha ni mascota");
    }
  });
}

test("admin códigos stale: clasifica códigos reales por status y no importa códigos públicos ni textos", () => {
  for (const [status, code, expected] of [
    [404, "PET_MASCOTA_NOT_FOUND", "mascota-stale"], [409, "PET_MASCOTA_INACTIVA", "mascota-stale"],
    [404, "PET_CLIENTE_NOT_FOUND", "responsable-stale"], [409, "PET_RESPONSABLE_NO_ASOCIADO", "responsable-stale"],
    [404, "PET_SERVICIO_NOT_FOUND", "servicio-stale"], [409, "PET_SERVICIO_INACTIVO", "servicio-stale"],
    [409, "PET_SERVICIO_NO_ASOCIADO", "servicio-stale"], [404, "PET_EXTRA_NOT_FOUND", "extra-stale"],
    [409, "PET_EXTRA_INACTIVO", "extra-stale"], [409, "PET_EXTRA_NO_ASOCIADO", "extra-stale"],
    [409, "PET_SLOT_UNAVAILABLE", "slot-conflict"], [404, "PET_SERVICE_UNAVAILABLE", "other"],
    [500, "PET_SERVICIO_INACTIVO", "other"], [404, null, "other"],
  ] as const) assert.equal(petAdminBookingErrorKind(new PetAdminBookingApiError(status, code)), expected);
});

test("admin creación 201 de otra selección: no inventa éxito y no repite POST", async t => {
  let posts = 0;
  mockFetch(t, async (url, init) => {
    if (url.endsWith("/turnos")) {
      posts++;
      return response({ id: 123, fecha: input.fecha, hora: input.hora, horaFin: "11:40", estado: "activo", mascotaId: 6060, clienteId: 7001, servicioId: 2828 }, 201);
    }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await readyAdmin(controller);
  assert.equal(await controller.confirmar(), "error");
  assert.equal(controller.getSnapshot().state.success, null);
  assert.equal(controller.getSnapshot().issue?.kind, "creation-unknown");
  await nextTick();
  assert.equal(posts, 1);
});

test("admin recovery fallido de catálogo sin code: no interpreta mensajes ni entra en loop", async t => {
  let posts = 0;
  let serviceCalls = 0;
  mockFetch(t, async (url, init) => {
    if (url.endsWith("/servicios") && ++serviceCalls > 1) return response({ error: "Servicio inactivo" }, 409);
    if (url.endsWith("/turnos")) { posts++; return response({ code: "PET_SERVICIO_INACTIVO" }, 409); }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await readyAdmin(controller);
  await controller.confirmar();
  await waitAdmin(controller, value => !value.isRecovering && serviceCalls === 2);
  await nextTick(); await nextTick();
  assert.equal(serviceCalls, 2);
  assert.equal(posts, 1);
  assert.equal(controller.getSnapshot().issue?.kind, "read-error");
  assert.equal(petAdminBookingErrorKind(new PetAdminBookingApiError(404, null)), "other");
});

for (const failure of ["network", "500"] as const) {
  test(`admin creación ${failure}: resultado incierto sin replay ni éxito inventado`, async t => {
    let posts = 0;
    mockFetch(t, async (url, init) => {
      if (url.endsWith("/turnos")) {
        posts++;
        if (failure === "network") throw new TypeError("Failed to fetch");
        return response({ error: "interno" }, 500);
      }
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await readyAdmin(controller);
    assert.equal(await controller.confirmar(), "error");
    await nextTick(); await nextTick();
    assert.equal(posts, 1);
    assert.equal(controller.getSnapshot().state.success, null);
    assert.equal(controller.getSnapshot().issue?.kind, "creation-unknown");
    assert.equal(controller.getSnapshot().notice, "No pudimos confirmar el resultado de la reserva.");
    assert.equal(await controller.confirmar(), "ignored");
  });
}

for (const status of [401, 403]) {
  test(`admin creación ${status}: auth delegada a fetchWithAuth y permiso distinguible`, async t => {
    window.location.href = "";
    mockFetch(t, async (url, init) => url.endsWith("/turnos") ? response({ error: "no autorizado" }, status) : defaultAdminResponse(url, init));
    const controller = adminController(t);
    await readyAdmin(controller);
    await controller.confirmar();
    assert.equal(controller.getSnapshot().issue?.status, status);
    assert.equal(controller.getSnapshot().issue?.kind, status === 401 ? "unauthorized" : "forbidden");
    assert.equal(controller.getSnapshot().unauthorized, status === 401);
    assert.equal(storage.has("token"), status !== 401);
    assert.equal(window.location.href, status === 401 ? "/login" : "");
    assert.equal(await controller.confirmar(), "ignored");
  });
}

test("admin controller: subscribe/cleanup replay y dispose ignoran un POST tardío sin cancelarlo", async t => {
  const pending = deferred<Response>();
  let command: Record<string, unknown> | null = null;
  mockFetch(t, async (url, init) => {
    if (url.endsWith("/turnos")) { command = JSON.parse(String(init?.body)); assert.equal(init?.signal, undefined); return pending.promise; }
    return defaultAdminResponse(url, init);
  });
  const client = adminClient(t);
  const controller = createPetAdminBookingController(client);
  const firstSubscription = controller.subscribe(() => {});
  firstSubscription();
  const secondSubscription = controller.subscribe(() => {});
  t.after(() => { secondSubscription(); controller.dispose(); });
  await readyAdmin(controller);
  const creating = controller.confirmar();
  await waitAdmin(controller, () => command !== null);
  controller.dispose();
  pending.resolve(response({ id: 123, ...command, estado: "activo", horaFin: "11:40" }, 201));
  assert.equal(await creating, "created");
  assert.equal(controller.getSnapshot().state.success, null);
});

test("admin QueryObserver directo: disabled no consulta y Signal se consume sin retry", async t => {
  let calls = 0;
  mockFetch(t, async () => { calls++; return response({ error: "interno" }, 500); });
  const client = adminClient(t);
  const observer = new QueryObserver(client, petAdminAvailabilityQuery(null));
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  await nextTick();
  assert.equal(calls, 0);
  observer.setOptions(petAdminAvailabilityQuery(input));
  for (let i = 0; i < 100 && !observer.getCurrentResult().isError; i++) await nextTick();
  assert.equal(observer.getCurrentResult().isError, true);
  assert.equal(calls, 1);
});
