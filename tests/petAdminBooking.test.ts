import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "../src/shared/lib/queryKeys.ts";
import { BUSINESS_TYPE } from "../src/shared/types/businessType.ts";
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
    raza: null,
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

function mascotaSearchDto(overrides: Record<string, unknown> = {}) {
  return { id: 6059, nombre: "Firulais", raza: null, responsables: [
    { id: 7001, nombre: "Ana", telefono: "11 2345-6789" },
    { id: 7002, nombre: "Juan", telefono: "11 8765-4321" },
  ], ...overrides };
}

test("search mascotas: GET exacto con q encoded, limit default 20, JWT, signal y proyección mínima", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response([mascotaSearchDto({ local_id: 5532, activo: 1, reserva_online_habilitada: 0,
      alta_exigencia: 1, observaciones: "internal", fecha_nacimiento: "2021-01-01", created_at: "ignored",
      responsables: [{ id: 7001, nombre: "Ana", telefono: "11 2345-6789", local_id: 5532, telefono_normalizado: "internal" },
        { id: 7002, nombre: "Juan", telefono: "11 8765-4321" }] })]);
  });
  const q = "Firúláis & +54 %_\\";
  const result = await petAdminBookingService.buscarMascotas({ q, signal });
  assert.equal(request?.url, `/api/pet/admin/mascotas/search?${new URLSearchParams({ q, limit: "20" })}`);
  assert.equal(request?.init?.method, "GET");
  assert.equal(request?.init?.cache, "no-store");
  assert.equal(request?.init?.signal, signal);
  assert.equal(new Headers(request?.init?.headers).get("Authorization"), "Bearer ADMIN_JWT_TEST_SENTINEL");
  assert.deepEqual(result, [mascotaSearchDto()]);
});

test("search mascotas: límite explícito, raza string, cero responsables y vacío son válidos", async t => {
  let url = "";
  mockFetch(t, async requestUrl => {
    url = requestUrl;
    return response([mascotaSearchDto({ raza: "Mestizo", responsables: [] })]);
  });
  assert.deepEqual(await petAdminBookingService.buscarMascotas({ q: "Luna", limit: 5 }), [mascotaSearchDto({ raza: "Mestizo", responsables: [] })]);
  assert.equal(url, "/api/pet/admin/mascotas/search?q=Luna&limit=5");
  mockFetch(t, async requestUrl => { url = requestUrl; return response([]); });
  assert.deepEqual(await petAdminBookingService.buscarMascotas(), []);
  assert.equal(url, "/api/pet/admin/mascotas/search?q=&limit=20");
});

test("search mascotas: parser estricto rechaza arrays/IDs/raza/responsables inválidos", async t => {
  for (const payload of [
    {}, [null], [mascotaSearchDto({ id: "6059" })], [mascotaSearchDto({ id: 0 })],
    [mascotaSearchDto({ nombre: null })], [mascotaSearchDto({ raza: undefined })], [mascotaSearchDto({ raza: 7 })],
    [mascotaSearchDto({ responsables: null })], [mascotaSearchDto({ responsables: [{}] })],
    [mascotaSearchDto({ responsables: [{ id: 7001, nombre: "Ana", telefono: 1123456789 }] })],
  ]) {
    mockFetch(t, async () => response(payload));
    await assert.rejects(petAdminBookingService.buscarMascotas({ q: "firu" }), error => {
      assert.ok(error instanceof PetAdminBookingApiError);
      assert.equal(error.status, 200);
      assert.equal(error.code, null);
      return true;
    });
  }
});

test("search mascotas: errores HTTP conservan status/code sin copiar datos remotos", async t => {
  for (const [status, code] of [[400, "PET_MASCOTA_SEARCH_INVALID"], [403, null], [500, null]] as const) {
    mockFetch(t, async () => response({ error: "REMOTE_INTERNAL_SENTINEL", ...(code ? { code } : {}) }, status));
    await assert.rejects(petAdminBookingService.buscarMascotas({ q: "fi" }), error => {
      assert.ok(error instanceof PetAdminBookingApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.ok(!error.message.includes("REMOTE_INTERNAL_SENTINEL"));
      return true;
    });
  }
});

test("search mascotas: AbortSignal cancela lectura sin convertir AbortError", async t => {
  const controller = new AbortController();
  mockFetch(t, async (_url, init) => new Promise<Response>((_resolve, reject) => {
    assert.equal(init?.signal, controller.signal);
    init?.signal?.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  }));
  const pending = petAdminBookingService.buscarMascotas({ q: "firu", signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error === controller.signal.reason);
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
    raza: null,
    activo: true,
    reservaOnlineHabilitada: false,
    responsables: [{ clienteId: 7001, nombre: "Ana", telefono: "+541123456789" }],
  });
});

test("detalle mascota: shape de responsables o raza inválido no se acepta", async t => {
  mockFetch(t, async () => response({ ...mascotaDto(), responsables: [{ id: 7001, nombre: "Ana" }] }));
  await assert.rejects(petAdminBookingService.obtenerMascota(6059), error => {
    assert.ok(error instanceof PetAdminBookingApiError);
    assert.equal(error.status, 200);
    return true;
  });
  mockFetch(t, async () => response({ ...mascotaDto(), raza: 7, responsables: [] }));
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
  petAdminMascotasQuery, petAdminSearchMascotasQuery, petAdminDetailQuery, petAdminServiciosQuery, petAdminExtrasQuery,
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
  const controller = createPetAdminBookingController(client, { searchActive: true });
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => { unsubscribe(); controller.dispose(); });
  return controller;
}

function servicesDto() { return configuredServices.map(item => ({ id: item.id, nombre: item.nombre, activo: Number(item.activo), duracion_minutos: item.duracionMinutos })); }
function extrasDto() { return configuredExtras.map(item => ({ id: item.id, nombre: item.nombre, activo: Number(item.activo), duracion_minutos: item.duracionMinutos })); }
function detailDto(id = 6059) {
  return { ...mascotaDto({ id, nombre: id === 6059 ? "Firulais" : "Luna", raza: id === 6059 ? "Mestizo" : null }),
    responsables: [{ id: id === 6059 ? 7001 : 7002, nombre: "Ana", telefono: responsible.telefono }] };
}
function isAdminSearch(url: string) { return new URL(url, "http://localhost").pathname === "/api/pet/admin/mascotas/search"; }
function defaultAdminResponse(url: string, init?: RequestInit): Response {
  assert.ok(!url.endsWith("/mascotas"), "el controller no debe consultar el listado completo");
  if (isAdminSearch(url)) return response([mascotaSearchDto(), mascotaSearchDto({ id: 6060, nombre: "Luna" })]);
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
  if (controller.getSnapshot().searchTerm === "") controller.setSearchTerm("fi");
  controller.setSearchActive(true);
  await waitAdmin(controller, value => value.queries.search.isSuccess && !value.queries.search.isFetching);
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
  assert.equal(adminReducer(petAdminInitialState(), { type: "RECONCILE_DETAIL", detail: { ...pet, responsables: [responsible] }, initial: true }).draft.mascotaId, null);
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
  // B.3 replaces list absence with authoritative detail invalidation.
  assert.deepEqual(adminReducer(state, { type: "RECONCILE_DETAIL", detail: { ...pet, activo: false, responsables: [] }, initial: false }), petAdminInitialState());
  assert.equal(adminReducer(state, { type: "MASCOTA_UNAVAILABLE", mascotaId: 6060 }), state);
  assert.deepEqual(adminReducer(state, { type: "MASCOTA_UNAVAILABLE", mascotaId: 6059 }), petAdminInitialState());
});

test("admin selectionKey: ASC determinista, sin responsable/PII; slot viejo rechazado", () => {
  const state = adminDraftState();
  assert.equal(petAdminSelectionKey(state.draft), petAdminSelectionKey({ ...state.draft, extraIds: [9596, 9595] }));
  assert.equal(petAdminSelectionKey(state.draft).includes("7001"), false);
  const next = adminReducer(state, { type: "SET_FECHA", fecha: "2026-10-21" });
  assert.equal(adminReducer(next, { type: "SET_SLOT", slot: state.draft.slotSeleccionado! }).draft.slotSeleccionado, null);
});

test("admin queries: namespace separado, enabled, política de lectura y mutation sin retry", () => {
  const queries = [petAdminMascotasQuery(), petAdminSearchMascotasQuery("fi", 20, true), petAdminDetailQuery(6059), petAdminServiciosQuery(6059), petAdminExtrasQuery(6059), petAdminAvailabilityQuery(input)];
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

test("admin controller: dependencias por detalle, solo elige resultados visibles y no exige responsable para slots", async t => {
  const requests: string[] = [];
  mockFetch(t, async (url, init) => { requests.push(url); return defaultAdminResponse(url, init); });
  const controller = adminController(t);
  await chooseAdminPet(controller);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7001);
  assert.equal(controller.getSnapshot().state.draft.servicioId, null);
  assert.deepEqual(controller.getSnapshot().searchResults.map(item => item.id), [6059, 6060]);
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
  for (const items of [[], [mascotaSearchDto()]]) {
    mockFetch(t, async (url, init) => isAdminSearch(url) ? response(items) : defaultAdminResponse(url, init));
    const controller = adminController(t);
    controller.setSearchTerm("fi");
    await waitAdmin(controller, value => value.queries.search.isSuccess);
    assert.equal(controller.getSnapshot().state.draft.mascotaId, null);
    assert.equal(controller.getSnapshot().searchResults.length, items.length);
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
  let detailCalls = 0;
  mockFetch(t, async (url, init) => {
    if (url.startsWith("/api/pet/admin/mascotas/6059")) {
      // B.3 waits for authoritative detail before loading catalogues. Hold its later refresh too.
      if (url.endsWith("/6059") && ++detailCalls === 1) return response(detailDto());
      assert.ok(init?.signal);
      signals.push(init.signal);
      return url.endsWith("/servicios") ? pending.servicios.promise : url.endsWith("/extras") ? pending.extras.promise : pending.detail.promise;
    }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  controller.setSearchTerm("fi");
  await waitAdmin(controller, value => value.queries.search.isSuccess);
  controller.setMascota(6059);
  await waitAdmin(controller, () => signals.length === 2);
  const refreshing = controller.refetchDetail();
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
  await refreshing;
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
  const base = petAdminSuccessSnapshot(state.draft, { ...pet, responsables: [responsible] }, configuredServices, configuredExtras, adminAvailability);
  assert.ok(base);
  assert.equal(base.responsableTelefono, responsible.telefono);
  assert.equal("mascotas" in state, false);
  assert.equal(petAdminSuccessSnapshot({ ...state.draft, clienteId: null }, { ...pet, responsables: [responsible] }, configuredServices, configuredExtras, adminAvailability), null);
});

for (const [code, status, target] of [
  ["PET_SLOT_UNAVAILABLE", 409, "availability"],
  ["PET_SERVICIO_INACTIVO", 409, "servicios"],
  ["PET_EXTRA_NO_ASOCIADO", 409, "extras"],
  ["PET_RESPONSABLE_NO_ASOCIADO", 409, "detail"],
  ["PET_MASCOTA_INACTIVA", 409, "detail"],
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
          if (target === "detail") return code === "PET_MASCOTA_INACTIVA" ? response({ ...detailDto(), activo: 0 })
            : response({ ...detailDto(), responsables: [{ id: 7002, nombre: "Otra", telefono: responsible.telefono }] });
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
    if (code === "PET_MASCOTA_INACTIVA") assert.deepEqual(after, petAdminInitialState().draft);
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
    controller.setSearchTerm("otra");
    await waitAdmin(controller, value => value.queries.search.isSuccess && !value.searchLoading);
    assert.equal(controller.getSnapshot().issue?.kind, "creation-unknown", "buscar no elimina el bloqueo de resultado incierto");
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

test("admin search keys/options: trim y limit en namespace propio, sin identidad y política sin retry", () => {
  const key = queryKeys.petAdminBooking.searchMascotas(" fi ", 20);
  assert.deepEqual(key, ["pet-admin-booking", "search-mascotas", "fi", 20]);
  assert.notDeepEqual(key, queryKeys.petAdminBooking.searchMascotas("lu", 20));
  assert.notDeepEqual(key, queryKeys.petAdminBooking.searchMascotas("fi", 5));
  assert.notDeepEqual(key, queryKeys.petAdminBooking.mascotas());
  const query = petAdminSearchMascotasQuery(" fi ", 20, true);
  assert.deepEqual(query.queryKey, key);
  assert.equal(query.enabled, true);
  assert.equal(petAdminSearchMascotasQuery("").enabled, false, "inactiva por defecto");
  assert.equal(petAdminSearchMascotasQuery("", 20, true).enabled, false, "vacío no consulta");
  assert.equal(petAdminSearchMascotasQuery("  ", 20, true).enabled, false, "whitespace no consulta");
  assert.equal(petAdminSearchMascotasQuery(" f ", 20, true).enabled, false);
  assert.equal(petAdminSearchMascotasQuery(" fi ", 20, true).enabled, true);
  assert.equal(petAdminSearchMascotasQuery("a".repeat(101), 20, true).enabled, false);
  assert.equal(petAdminSearchMascotasQuery("fi", 21, true).enabled, false);
  for (const name of ["token", "localId", "clienteId", "ADMIN_JWT_TEST_SENTINEL"]) {
    assert.ok(!JSON.stringify(key).includes(name));
  }
});

test("admin search controller: activar con vacío y 1 carácter no consultan; 2+ busca con signal", async t => {
  const calls: Array<{ q: string | null; signal: AbortSignal | null }> = [];
  mockFetch(t, async (url, init) => {
    assert.ok(isAdminSearch(url));
    const query = new URL(url, "http://localhost").searchParams;
    assert.equal(query.get("limit"), "20");
    calls.push({ q: query.get("q"), signal: init?.signal ?? null });
    return response([mascotaSearchDto()]);
  });
  const controller = createPetAdminBookingController(adminClient(t));
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => { unsubscribe(); controller.dispose(); });
  controller.setSearchActive(true);
  await nextTick(); await nextTick();
  assert.equal(calls.length, 0, "activar con q vacío no consulta");
  await controller.refetchSearch();
  await nextTick();
  assert.equal(calls.length, 0, "refetch de q vacío tampoco consulta");
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  assert.equal(controller.getSnapshot().searchLoading, false);
  controller.setSearchTerm(" f ");
  await controller.refetchSearch();
  await nextTick();
  assert.equal(calls.length, 0, "1 carácter no consulta");
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  controller.setSearchTerm(" fi ");
  await waitAdmin(controller, value => value.searchResults.length === 1);
  assert.deepEqual(calls.map(item => item.q), ["fi"]);
  controller.setSearchTerm("fir");
  await waitAdmin(controller, () => calls.length === 2);
  assert.deepEqual(calls.map(item => item.q), ["fi", "fir"]);
  assert.equal(controller.getSnapshot().searchTerm, "fir");
  assert.ok(calls.every(item => item.signal instanceof AbortSignal));
  controller.setSearchActive(false);
  controller.setSearchTerm("luna");
  await controller.refetchSearch();
  await nextTick();
  assert.equal(calls.length, 2);
});

test("admin search A/B: A se aborta, no permite seleccionar resultados viejos y B gana a A tardía", async t => {
  const a = deferred<Response>();
  const b = deferred<Response>();
  const signals = new Map<string, AbortSignal>();
  mockFetch(t, async (url, init) => {
    assert.ok(isAdminSearch(url), "sin selección válida no debe cargar detalle");
    const term = new URL(url, "http://localhost").searchParams.get("q")!;
    assert.ok(init?.signal);
    signals.set(term, init.signal);
    return term === "fi" ? a.promise : b.promise;
  });
  const controller = createPetAdminBookingController(adminClient(t));
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => { unsubscribe(); controller.dispose(); });
  controller.setSearchTerm("fi");
  controller.setSearchActive(true);
  await waitAdmin(controller, () => signals.has("fi"));
  controller.setSearchTerm("lu");
  await waitAdmin(controller, () => signals.has("lu"));
  assert.equal(signals.get("fi")?.aborted, true);
  controller.setMascota(6059);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, null);
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  b.resolve(response([mascotaSearchDto({ id: 6060, nombre: "Luna" })]));
  await waitAdmin(controller, value => value.searchResults[0]?.id === 6060);
  a.resolve(response([mascotaSearchDto()]));
  await nextTick(); await nextTick();
  assert.equal(controller.getSnapshot().searchTerm, "lu");
  assert.deepEqual(controller.getSnapshot().searchResults.map(item => item.id), [6060]);
  controller.setMascota(6059);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, null);
});

test("admin selección confirmable sobrevive firu→fir→vacío→1 carácter→clearSearch, sin cambiar key ni detalle", async t => {
  const calls: string[] = [];
  mockFetch(t, async (url, init) => {
    calls.push(url);
    if (isAdminSearch(url)) {
      const term = new URL(url, "http://localhost").searchParams.get("q");
      return response(term === "firu" ? [mascotaSearchDto()] : [mascotaSearchDto({ id: 6060, nombre: "Luna" })]);
    }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  controller.setSearchTerm("firu");
  await readyAdmin(controller);
  const before = structuredClone(controller.getSnapshot().state.draft);
  const detail = controller.getSnapshot().selectedPetDetail;
  const key = petAdminSelectionKey(before);
  const detailReads = calls.filter(url => !isAdminSearch(url)).length;
  for (const term of ["fir", ""]) {
    controller.setSearchTerm(term);
    assert.equal(controller.getSnapshot().canConfirm, true, "búsqueda en curso no es fetch crítico");
    if (term !== "") {
      await waitAdmin(controller, value => value.queries.search.isSuccess && !value.searchLoading);
    } else {
      await nextTick(); await nextTick();
    }
    assert.ok(!controller.getSnapshot().searchResults.some(item => item.id === 6059));
    assert.deepEqual(controller.getSnapshot().state.draft, before);
    assert.equal(controller.getSnapshot().selectedPetDetail, detail);
    assert.equal(controller.getSnapshot().canConfirm, true);
  }
  controller.setSearchTerm("f");
  controller.clearSearch();
  assert.equal(controller.getSnapshot().searchTerm, "");
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  assert.equal(controller.getSnapshot().searchActive, false);
  assert.deepEqual(controller.getSnapshot().state.draft, before);
  assert.equal(controller.getSnapshot().selectedPetDetail, detail);
  assert.equal(petAdminSelectionKey(controller.getSnapshot().state.draft), key);
  assert.equal(controller.getSnapshot().canConfirm, true, "online=false del detalle sigue confirmable");
  assert.equal(calls.filter(url => !isAdminSearch(url)).length, detailReads);
});

test("admin búsqueda de nombres duplicados selecciona por ID y detalle es autoridad antes de catálogos", async t => {
  const pendingDetail = deferred<Response>();
  const calls: string[] = [];
  mockFetch(t, async (url, init) => {
    calls.push(url);
    if (isAdminSearch(url)) return response([mascotaSearchDto(), mascotaSearchDto({ id: 6060 })]);
    if (url.endsWith("/mascotas/6060")) return pendingDetail.promise;
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  controller.setSearchTerm("fi");
  await waitAdmin(controller, value => value.searchResults.length === 2);
  controller.setMascota(6060);
  await waitAdmin(controller, value => value.queries.detail.isFetching);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, 6060);
  assert.equal(controller.getSnapshot().selectedPetDetail, null);
  assert.deepEqual(controller.getSnapshot().responsables, []);
  assert.ok(!calls.some(url => url.endsWith("/servicios") || url.endsWith("/extras")));
  pendingDetail.resolve(response(detailDto(6060)));
  await waitAdmin(controller, value => value.queries.servicios.isSuccess && value.queries.extras.isSuccess);
  assert.equal(controller.getSnapshot().selectedPetDetail?.nombre, "Luna");
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7002, "responsable de detalle, no el del resultado");
  controller.setMascota(6059);
  assert.deepEqual(controller.getSnapshot().state.draft, { ...petAdminInitialState().draft, mascotaId: 6059 });
  await waitAdmin(controller, value => value.selectedPetDetail?.id === 6059);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7001);
});

test("admin snapshot usa nombre del detalle, jamás searchResults; refresh durante POST no cambia éxito", async t => {
  const pending = deferred<Response>();
  const client = adminClient(t);
  let command: Record<string, unknown> | undefined;
  mockFetch(t, async (url, init) => {
    if (isAdminSearch(url)) return response([mascotaSearchDto({ nombre: "Nombre viejo de búsqueda" })]);
    if (url.endsWith("/mascotas/6059")) return response({ ...detailDto(), nombre: "Nombre autoritativo" });
    if (url.endsWith("/turnos")) { command = JSON.parse(String(init?.body)); return pending.promise; }
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t, client);
  await readyAdmin(controller);
  controller.clearSearch();
  const creating = controller.confirmar();
  await waitAdmin(controller, () => command !== undefined);
  client.setQueryData(queryKeys.petAdminBooking.mascotaDetail(6059), { ...pet, nombre: "Refresh posterior", responsables: [responsible] });
  pending.resolve(response({ ...command, id: 123, horaFin: "11:40", estado: "activo" }, 201));
  assert.equal(await creating, "created");
  const success = controller.getSnapshot().state.success;
  assert.equal(success?.mascotaNombre, "Nombre autoritativo");
  assert.equal(success?.responsableNombre, "Ana");
  assert.ok(Object.isFrozen(success));
});

for (const failure of ["inactive", "404-without-code", "404-domain-code"] as const) {
  test(`admin detalle confirma ${failure}: limpia draft aunque búsqueda todavía incluya mascota`, async t => {
    let invalid = false;
    let detailReads = 0;
    mockFetch(t, async (url, init) => {
      if (url.endsWith("/mascotas/6059")) {
        detailReads++;
        if (invalid) return failure === "inactive" ? response({ ...detailDto(), activo: 0 })
          : response({ error: "texto no interpretado", ...(failure === "404-domain-code" ? { code: "PET_MASCOTA_NOT_FOUND" } : {}) }, 404);
      }
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await readyAdmin(controller);
    invalid = true;
    await controller.refetchDetail();
    await waitAdmin(controller, value => value.state.draft.mascotaId === null);
    assert.deepEqual(controller.getSnapshot().state.draft, petAdminInitialState().draft);
    assert.equal(controller.getSnapshot().selectedPetDetail, null);
    assert.equal(controller.getSnapshot().canConfirm, false);
    assert.ok(controller.getSnapshot().searchResults.some(item => item.id === 6059));
    await nextTick(); await nextTick();
    assert.equal(detailReads, 2, "no refetch recursivo del mismo detalle inválido");
  });
}

test("admin detalle fetching bloquea confirmar; un refresh válido conserva selección y detalle gobierna snapshot", async t => {
  const pending = deferred<Response>();
  let detailReads = 0;
  mockFetch(t, async (url, init) => url.endsWith("/mascotas/6059") && ++detailReads > 1 ? pending.promise : defaultAdminResponse(url, init));
  const controller = adminController(t);
  await readyAdmin(controller);
  const before = structuredClone(controller.getSnapshot().state.draft);
  const refreshing = controller.refetchDetail();
  assert.equal(controller.getSnapshot().canConfirm, false);
  assert.equal(await controller.confirmar(), "ignored");
  pending.resolve(response({ ...detailDto(), nombre: "Actualizado" }));
  await refreshing;
  await waitAdmin(controller, value => value.canConfirm);
  assert.deepEqual(controller.getSnapshot().state.draft, before);
  assert.equal(controller.getSnapshot().selectedPetDetail?.nombre, "Actualizado");
});

for (const source of ["search", "servicios", "extras", "availability", "create"] as const) {
  test(`admin 404 sin code en ${source} NO invalida mascota ni interpreta mensaje`, async t => {
    let fail = false;
    mockFetch(t, async (url, init) => {
      const matches = source === "search" ? isAdminSearch(url) : source === "availability" ? url.includes("/disponibilidad?")
        : url.endsWith(source === "create" ? "/turnos" : `/${source}`);
      if (fail && matches) return response({ error: "Mascota no encontrada" }, 404);
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await readyAdmin(controller);
    const before = structuredClone(controller.getSnapshot().state.draft);
    fail = true;
    if (source === "search") {
      controller.setSearchTerm("otra");
      await waitAdmin(controller, value => value.searchError !== null);
      assert.equal(controller.getSnapshot().canConfirm, true);
      assert.equal(controller.getSnapshot().issue, null);
    } else if (source === "servicios") await controller.refetchServicios();
    else if (source === "extras") await controller.refetchExtras();
    else if (source === "availability") await controller.refetchAvailability();
    else await controller.confirmar();
    assert.deepEqual(controller.getSnapshot().state.draft, before);
    assert.equal(controller.getSnapshot().selectedPetDetail?.id, 6059);
    assert.equal(controller.getSnapshot().isRecovering, false);
  });
}

test("admin mascota-stale del POST refetchea solo detalle, no busca ni invalida por ausencia en resultados", async t => {
  let searchReads = 0;
  let detailReads = 0;
  mockFetch(t, async (url, init) => {
    if (isAdminSearch(url)) searchReads++;
    if (url.endsWith("/mascotas/6059")) detailReads++;
    if (url.endsWith("/turnos")) return response({ code: "PET_MASCOTA_NOT_FOUND" }, 404);
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await readyAdmin(controller);
  controller.clearSearch();
  const searchesBefore = searchReads;
  await controller.confirmar();
  await waitAdmin(controller, value => !value.isRecovering && detailReads === 2);
  assert.equal(controller.getSnapshot().state.draft.mascotaId, 6059);
  assert.equal(controller.getSnapshot().state.draft.clienteId, 7001);
  assert.equal(controller.getSnapshot().state.draft.slotSeleccionado, null);
  assert.equal(searchReads, searchesBefore);
  assert.deepEqual(controller.getSnapshot().searchResults, []);
});

test("admin recovery mascota: POST stale seguido de detalle 404 sin code limpia una vez y no repite POST", async t => {
  let posts = 0;
  let detailReads = 0;
  mockFetch(t, async (url, init) => {
    if (url.endsWith("/turnos")) { posts++; return response({ code: "PET_MASCOTA_INACTIVA" }, 409); }
    if (url.endsWith("/mascotas/6059") && ++detailReads > 1) return response({ error: "no encontrada" }, 404);
    return defaultAdminResponse(url, init);
  });
  const controller = adminController(t);
  await readyAdmin(controller);
  await controller.confirmar();
  await waitAdmin(controller, value => !value.isRecovering && value.state.draft.mascotaId === null);
  assert.equal(detailReads, 2);
  assert.equal(posts, 1);
  assert.deepEqual(controller.getSnapshot().state.draft, petAdminInitialState().draft);
});

test("admin startNewBooking limpia búsqueda/cachés propias y no borra keys de otros flujos", async t => {
  let searchReads = 0;
  mockFetch(t, async (url, init) => {
    if (isAdminSearch(url)) searchReads++;
    return defaultAdminResponse(url, init);
  });
  const client = adminClient(t);
  const foreignKey = queryKeys.turnos.lista(input.fecha);
  const unrelatedSearchKey = queryKeys.petAdminBooking.searchMascotas("ajena", 5);
  client.setQueryData(foreignKey, ["sentinel"]);
  client.setQueryData(unrelatedSearchKey, ["external-search"]);
  const controller = adminController(t, client);
  controller.setSearchTerm("firu");
  await readyAdmin(controller);
  const searchReadsBeforeStart = searchReads;
  assert.equal(await controller.confirmar(), "created");
  controller.startNewBooking();
  await nextTick(); await nextTick();
  assert.equal(searchReads, searchReadsBeforeStart, "startNewBooking no dispara búsqueda");
  assert.deepEqual(controller.getSnapshot().state, petAdminInitialState());
  assert.equal(controller.getSnapshot().searchTerm, "");
  assert.equal(controller.getSnapshot().searchActive, false);
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  assert.equal(controller.getSnapshot().selectedPetDetail, null);
  await new Promise(resolve => setTimeout(resolve, 0)); // gcTime: 0 releases the old, now unobserved search.
  assert.equal(client.getQueryData(queryKeys.petAdminBooking.searchMascotas("firu", 20)), undefined);
  assert.equal(client.getQueryData(queryKeys.petAdminBooking.searchMascotas("", 20)), undefined);
  assert.deepEqual(client.getQueryData(foreignKey), ["sentinel"]);
  assert.deepEqual(client.getQueryData(unrelatedSearchKey), ["external-search"]);
});

test("admin clearSearch no cancela ni borra una búsqueda compartida con otro observer", async t => {
  const pending = deferred<Response>();
  let signal: AbortSignal | undefined;
  mockFetch(t, async (_url, init) => { signal = init?.signal ?? undefined; return pending.promise; });
  const client = adminClient(t);
  const observer = new QueryObserver(client, petAdminSearchMascotasQuery("fi", 20, true));
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  const controller = adminController(t, client);
  controller.setSearchTerm("fi");
  await waitAdmin(controller, () => signal !== undefined);
  controller.clearSearch();
  assert.equal(signal?.aborted, false);
  pending.resolve(response([mascotaSearchDto()]));
  for (let i = 0; i < 100 && !observer.getCurrentResult().isSuccess; i++) await nextTick();
  assert.equal(observer.getCurrentResult().data?.[0].id, 6059);
  assert.deepEqual(controller.getSnapshot().searchResults, []);
});

test("admin clearSearch cancela su propia búsqueda pendiente; respuesta tardía no reaparece", async t => {
  const pending = deferred<Response>();
  let signal: AbortSignal | undefined;
  mockFetch(t, async (_url, init) => { signal = init?.signal ?? undefined; return pending.promise; });
  const controller = adminController(t);
  controller.setSearchTerm("fi");
  await waitAdmin(controller, () => signal !== undefined);
  controller.clearSearch();
  assert.equal(signal?.aborted, true);
  assert.equal(controller.getSnapshot().searchLoading, false);
  assert.equal(controller.getSnapshot().searchError, null);
  pending.resolve(response([mascotaSearchDto()]));
  await nextTick(); await nextTick();
  assert.deepEqual(controller.getSnapshot().searchResults, []);
  assert.deepEqual(controller.getSnapshot().state, petAdminInitialState());
});

for (const [status, code] of [[403, null], [500, null], [409, "PET_MASCOTA_INACTIVA"]] as const) {
  test(`admin error de búsqueda ${status}/${code} no bloquea confirmación ni inicia recovery de selección`, async t => {
    let fail = false;
    mockFetch(t, async (url, init) => fail && isAdminSearch(url) ? response({ code }, status) : defaultAdminResponse(url, init));
    const controller = adminController(t);
    await readyAdmin(controller);
    const before = structuredClone(controller.getSnapshot().state.draft);
    fail = true;
    controller.setSearchTerm("nueva");
    await waitAdmin(controller, value => value.searchError !== null);
    assert.deepEqual(controller.getSnapshot().state.draft, before);
    assert.equal(controller.getSnapshot().canConfirm, true);
    assert.equal(controller.getSnapshot().isRecovering, false);
    assert.equal(controller.getSnapshot().issue, null);
  });
}

test("admin 401 de búsqueda conserva invalidación auth existente y bloquea confirmación sin limpiar draft", async t => {
  let fail = false;
  mockFetch(t, async (url, init) => fail && isAdminSearch(url) ? response({}, 401) : defaultAdminResponse(url, init));
  const controller = adminController(t);
  await readyAdmin(controller);
  const before = structuredClone(controller.getSnapshot().state.draft);
  fail = true;
  controller.setSearchTerm("nueva");
  await waitAdmin(controller, value => value.unauthorized);
  assert.equal(controller.getSnapshot().canConfirm, false);
  assert.equal(controller.getSnapshot().issue?.kind, "unauthorized");
  assert.deepEqual(controller.getSnapshot().state.draft, before);
  assert.equal(storage.has("token"), false);
  assert.equal(window.location.href, "/login");
});

for (const [status, code] of [[500, null], [404, "UNRECOGNIZED_CODE"]] as const) {
  test(`admin detalle ${status}/${code} no demuestra inexistencia y conserva draft sin loop`, async t => {
    let fail = false;
    let details = 0;
    mockFetch(t, async (url, init) => {
      if (url.endsWith("/mascotas/6059")) {
        details++;
        if (fail) return response({ code, error: "Mascota no encontrada" }, status);
      }
      return defaultAdminResponse(url, init);
    });
    const controller = adminController(t);
    await readyAdmin(controller);
    const before = structuredClone(controller.getSnapshot().state.draft);
    fail = true;
    await controller.refetchDetail();
    assert.deepEqual(controller.getSnapshot().state.draft, before);
    assert.equal(controller.getSnapshot().canConfirm, false, "detalle en error no permite crear");
    assert.equal(controller.getSnapshot().isRecovering, false);
    assert.equal(controller.getSnapshot().issue?.kind, "read-error");
    await nextTick(); await nextTick();
    assert.equal(details, 2);
  });
}

const { getAdminBookingVariant } = await import("../src/feature/admin/pages/adminPage/bookingVariant.ts");
const { petAdminBookingIssueMessage, petAdminDateLabel, petAdminSlotLabel } = await import("../src/feature/admin/petBooking/booking/petAdminBookingView.ts");
const {
  PET_ADMIN_SEARCH_DEBOUNCE_MS, PET_ADMIN_SEARCH_EMPTY_MESSAGE, PET_ADMIN_SEARCH_LIMIT_MESSAGE,
  PET_ADMIN_SEARCH_TOO_SHORT_MESSAGE, petAdminSearchInputState, petAdminSearchNormalizedTerm,
  petAdminSearchOptions, petAdminSearchRequestTerm, petAdminSearchResultMeta, petAdminSearchSelectedRaza,
} = await import("../src/feature/admin/petBooking/components/petAdminPetSearchView.ts");

test("AdminContent variant selector: PET_GROOMING usa variante PET y BEAUTY conserva la anterior", () => {
  assert.equal(getAdminBookingVariant(BUSINESS_TYPE.PET_GROOMING), "PET");
  assert.equal(getAdminBookingVariant(BUSINESS_TYPE.BEAUTY), "BEAUTY");
});

test("PET admin view helpers: labels de slot/fecha y copy seguro por código de dominio", () => {
  assert.equal(petAdminSlotLabel("10:00", "11:30"), "10:00 – 11:30");
  assert.match(petAdminDateLabel("2026-10-20"), /20/);
  assert.equal(petAdminBookingIssueMessage({ kind: "slot-conflict", source: "create", status: 409, code: "PET_SLOT_UNAVAILABLE" }),
    "Ese horario acaba de dejar de estar disponible.");
  assert.equal(petAdminBookingIssueMessage({ kind: "mascota-stale", source: "create", status: 409, code: "PET_MASCOTA_INACTIVA" }),
    "La información de la mascota cambió. Revisá la selección.");
  assert.equal(petAdminBookingIssueMessage({ kind: "responsable-stale", source: "create", status: 409, code: "PET_RESPONSABLE_NO_ASOCIADO" }),
    "El responsable seleccionado ya no está asociado a esta mascota. Revisá la selección.");
  assert.equal(petAdminBookingIssueMessage({ kind: "servicio-stale", source: "create", status: 409, code: "PET_SERVICIO_INACTIVO" }),
    "La configuración del servicio cambió. Revisá la selección.");
  assert.equal(petAdminBookingIssueMessage({ kind: "extra-stale", source: "create", status: 409, code: "PET_EXTRA_INACTIVO" }),
    "La configuración de algunos extras cambió. Revisá la selección.");
  assert.equal(petAdminBookingIssueMessage({ kind: "forbidden", source: "create", status: 403, code: "PET_LOCAL_REQUIRED" }),
    "No tenés permisos para realizar esta operación.");
  assert.equal(petAdminBookingIssueMessage({ kind: "creation-unknown", source: "create", status: 500, code: null }),
    "No pudimos confirmar el resultado de la reserva. Revisá la agenda antes de intentarlo nuevamente.");
  assert.equal(petAdminBookingIssueMessage({ kind: "read-error", source: "availability", status: 500, code: null }), null);
});

test("PET admin búsqueda UI: debounce, trim y mínimos sin disparar el contrato inválido", () => {
  assert.equal(PET_ADMIN_SEARCH_DEBOUNCE_MS, 300);
  assert.equal(petAdminSearchNormalizedTerm("  firu  "), "firu");
  assert.equal(petAdminSearchRequestTerm(""), null);
  assert.equal(petAdminSearchRequestTerm("   "), null);
  assert.equal(petAdminSearchRequestTerm(" f "), null);
  assert.equal(petAdminSearchRequestTerm(" fi "), "fi");
  assert.equal(petAdminSearchRequestTerm(" fir "), "fir");
  assert.equal(petAdminSearchRequestTerm("a".repeat(101)), null);
  assert.equal(petAdminSearchInputState(""), "empty");
  assert.equal(petAdminSearchInputState("   "), "empty");
  assert.equal(petAdminSearchInputState(" f "), "too-short");
  assert.equal(petAdminSearchInputState(" fi "), "ready");
  assert.equal(PET_ADMIN_SEARCH_TOO_SHORT_MESSAGE, "Escribí al menos 2 caracteres.");
  assert.equal(PET_ADMIN_SEARCH_EMPTY_MESSAGE, "No encontramos mascotas con esa búsqueda.");
  assert.equal(PET_ADMIN_SEARCH_LIMIT_MESSAGE, "Hay varios resultados. Refiná la búsqueda para encontrar la mascota.");
});

test("PET admin búsqueda UI: resultados 0/1/2/3+ responsables, raza opcional y sin teléfonos múltiples", () => {
  assert.equal(petAdminSearchResultMeta({ raza: "Mestizo", responsables: [] }),
    "Mestizo · Sin responsable asociado");
  assert.equal(petAdminSearchResultMeta({ raza: null, responsables: [] }), "Sin responsable asociado");
  assert.equal(petAdminSearchResultMeta({ raza: "Mestizo", responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
  ] }), "Juan Pérez · 11 2345-6789 · Mestizo");
  assert.equal(petAdminSearchResultMeta({ raza: null, responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
  ] }), "Juan Pérez · 11 2345-6789");
  assert.equal(petAdminSearchResultMeta({ raza: "Mestizo", responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
    { id: 2, nombre: "María Gómez", telefono: "11 8765-4321" },
  ] }), "Juan Pérez · María Gómez · Mestizo");
  assert.equal(petAdminSearchResultMeta({ raza: "Mestizo", responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
    { id: 2, nombre: "María Gómez", telefono: "11 8765-4321" },
    { id: 3, nombre: "Ana Díaz", telefono: "11 1111-2222" },
  ] }), "Juan Pérez · María Gómez (+1) · Mestizo");
  assert.equal(petAdminSearchResultMeta({ raza: "  ", responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
  ] }), "Juan Pérez · 11 2345-6789");
});

test("PET admin búsqueda UI: nombres duplicados conservan IDs y la tarjeta usa raza del detalle", () => {
  const options = petAdminSearchOptions([
    mascotaSearchDto({ id: 6059, nombre: "Firulais", raza: "Mestizo", responsables: [
      { id: 7001, nombre: "Juan Pérez", telefono: "11 2345-6789" },
    ] }),
    mascotaSearchDto({ id: 6060, nombre: "Firulais", raza: "Caniche", responsables: [
      { id: 7002, nombre: "María Gómez", telefono: "11 8765-4321" },
    ] }),
  ]);
  assert.deepEqual(options.map(option => option.id), [6059, 6060]);
  assert.deepEqual(options.map(option => option.nombre), ["Firulais", "Firulais"]);
  assert.deepEqual(options.map(option => option.detalle), [
    "Juan Pérez · 11 2345-6789 · Mestizo",
    "María Gómez · 11 8765-4321 · Caniche",
  ]);
  assert.equal(petAdminSearchSelectedRaza({ ...pet, raza: " Mestizo " }), "Mestizo");
  assert.equal(petAdminSearchSelectedRaza({ ...pet, raza: "" }), null);
  assert.equal(petAdminSearchSelectedRaza(null), null);
});
