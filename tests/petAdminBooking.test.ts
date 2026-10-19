import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";

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
