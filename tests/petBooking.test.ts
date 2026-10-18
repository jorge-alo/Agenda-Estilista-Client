import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ordenarExtraIds,
  publicPetBookingService,
} from "../src/feature/publicPet/services/publicPetBooking.service.ts";
import { PublicPetHttpError } from "../src/feature/publicPet/services/publicPetHttp.ts";
import type {
  PetAvailabilityInput,
  PetBookingContext,
} from "../src/feature/publicPet/types/publicPetBooking.types.ts";

const context: PetBookingContext = { slug: "local/a", token: "PET_PRIVATE_TOKEN_SENTINEL" };
const input: PetAvailabilityInput = { mascotaId: 1, servicioId: 2, extraIds: [5, 3], fecha: "2026-10-25" };
const optionsDto = {
  servicios: [{ id: 2, nombre: "Baño y corte", duracionMinutos: 90 }],
  extras: [{ id: 3, nombre: "Corte de uñas", duracionExtraMinutos: 15 }],
};
const availabilityDto = {
  fecha: "2026-10-25", duracionMinutos: 120,
  slots: [{ horaInicio: "10:00", horaFin: "12:00" }],
};
const createdDto = { id: 123, fecha: "2026-10-25", hora: "10:00", horaFin: "12:00", estado: "activo" };

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function assertPrivateError(error: unknown, status: number, code: string | null): asserts error is PublicPetHttpError {
  assert.ok(error instanceof PublicPetHttpError);
  assert.equal(error.status, status);
  assert.equal(error.code, code);
  assert.equal(error.message, "PUBLIC_PET_HTTP_ERROR");
  assert.ok(!JSON.stringify(error).includes(context.token));
}

test("opciones: URL slug encoded, GET Bearer/no-store/signal y DTO proyectado", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(url), init };
    return response({ ...optionsDto, localId: 900, precio: 1 });
  });

  const result = await publicPetBookingService.getOpcionesReserva(context, 7, { signal });
  assert.equal(request?.url, "/api/pet/public/local%2Fa/mascotas/7/opciones-reserva");
  assert.equal(request?.init?.method, "GET");
  assert.deepEqual(request?.init?.headers, { Authorization: `Bearer ${context.token}` });
  assert.equal(request?.init?.cache, "no-store");
  assert.equal(request?.init?.signal, signal);
  assert.equal(request?.init?.body, undefined);
  assert.deepEqual(result, optionsDto);
  assert.ok(!JSON.stringify(result).includes("precio"));
});

test("opciones: conserva 401/404/409 y solo códigos backend allowlisted", async t => {
  for (const [status, code] of [
    [401, "PET_SESSION_INVALID"],
    [404, "PET_MASCOTA_UNAVAILABLE"],
    [409, "PET_BOOKING_UNAVAILABLE"],
  ] as const) {
    t.mock.method(globalThis, "fetch", async () => response({ error: code, detail: "PRIVATE_BODY_SENTINEL", token: context.token }, status));
    await assert.rejects(publicPetBookingService.getOpcionesReserva(context, 1), error => {
      assertPrivateError(error, status, code);
      assert.ok(!error.toString().includes("PRIVATE_BODY_SENTINEL"));
      return true;
    });
    t.mock.restoreAll();
  }

  t.mock.method(globalThis, "fetch", async () => response({ error: "PRIVATE_UNKNOWN_CODE", html: "proxy" }, 409));
  await assert.rejects(publicPetBookingService.getOpcionesReserva(context, 1), error => {
    assertPrivateError(error, 409, null);
    assert.ok(!error.toString().includes("PRIVATE_UNKNOWN_CODE"));
    return true;
  });
});

test("opciones: success con shape incompatible es error de protocolo", async t => {
  t.mock.method(globalThis, "fetch", async () => response({ servicios: [{ id: "2", nombre: "Baño", duracionMinutos: 90 }], extras: [] }));
  await assert.rejects(publicPetBookingService.getOpcionesReserva(context, 2), error => {
    assertPrivateError(error, 200, null);
    return true;
  });
});

test("disponibilidad: POST body exacto, extraIds ASC en copia, Bearer/no-store/signal", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  const inputWithUntrustedFields = Object.assign({ ...input, extraIds: [5, 3] }, {
    localId: 800, clienteId: 801, precio: 123, altaExigencia: true, estilistaId: 802, duracion: 999,
  });
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(url), init };
    return response({ ...availabilityDto, tenant: 900, precio: 55 });
  });

  const result = await publicPetBookingService.getDisponibilidad(context, inputWithUntrustedFields, { signal });
  assert.equal(request?.url, "/api/pet/public/local%2Fa/disponibilidad");
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, {
    Authorization: `Bearer ${context.token}`,
    "Content-Type": "application/json",
  });
  assert.equal(request?.init?.cache, "no-store");
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    mascotaId: 1, servicioId: 2, extraIds: [3, 5], fecha: "2026-10-25",
  });
  const sentBody = String(request?.init?.body);
  for (const privateField of [context.token, "localId", "clienteId", "precio", "altaExigencia", "estilistaId", "duracion"]) {
    assert.ok(!sentBody.includes(privateField));
  }
  assert.deepEqual(inputWithUntrustedFields.extraIds, [5, 3], "normalizar no muta el input");
  assert.deepEqual(result, availabilityDto);
  assert.ok(!JSON.stringify(result).includes("precio"));
  assert.ok(!JSON.stringify(result).includes("tenant"));
});

test("disponibilidad: slot/fecha/duración válidos y shape inválido producen resultado o error seguro", async t => {
  t.mock.method(globalThis, "fetch", async () => response(availabilityDto));
  assert.deepEqual(await publicPetBookingService.getDisponibilidad(context, input), availabilityDto);

  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => response({ ...availabilityDto, slots: [{ horaInicio: "10:00:00", horaFin: "12:00" }] }));
  await assert.rejects(publicPetBookingService.getDisponibilidad(context, input), error => {
    assertPrivateError(error, 200, null);
    return true;
  });

  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => response({ ...availabilityDto, fecha: "0000-01-01" }));
  await assert.rejects(publicPetBookingService.getDisponibilidad(context, input), error => {
    assertPrivateError(error, 200, null);
    return true;
  });
});

test("disponibilidad: transporta errores de catálogo, slot, SaaS, sesión y status HTTP", async t => {
  for (const [status, code] of [
    [400, "PET_BOOKING_INVALID"],
    [401, "PET_SESSION_INVALID"],
    [404, "PET_SERVICE_UNAVAILABLE"],
    [404, "PET_EXTRA_UNAVAILABLE"],
    [409, "PET_SLOT_UNAVAILABLE"],
    [409, "PET_BOOKING_UNAVAILABLE"],
    [429, null],
    [500, "INTERNAL_SERVER_ERROR"],
  ] as const) {
    t.mock.method(globalThis, "fetch", async () => response({ error: code ?? "UNRECOGNIZED_BACKEND_CODE", stack: context.token }, status));
    await assert.rejects(publicPetBookingService.getDisponibilidad(context, input), error => {
      assertPrivateError(error, status, code);
      return true;
    });
    t.mock.restoreAll();
  }
});

test("crear turno: POST body exacto y 201 se proyecta al DTO público activo", async t => {
  let request: { url: string; init?: RequestInit } | undefined;
  const inputWithUntrustedFields = Object.assign({ ...input, extraIds: [5, 3], hora: "10:00" }, {
    localId: 800, clienteId: 801, precio: 123, altaExigencia: true, estilistaId: 802, estado: "completado", horaFin: "23:59",
  });
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(url), init };
    return response({ ...createdDto, clienteId: 700, localId: 701, precio: 2 }, 201);
  });

  const result = await publicPetBookingService.crearTurno(context, inputWithUntrustedFields);
  assert.equal(request?.url, "/api/pet/public/local%2Fa/turnos");
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, {
    Authorization: `Bearer ${context.token}`,
    "Content-Type": "application/json",
  });
  assert.equal(request?.init?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    mascotaId: 1, servicioId: 2, extraIds: [3, 5], fecha: "2026-10-25", hora: "10:00",
  });
  const sentBody = String(request?.init?.body);
  for (const privateField of [context.token, "localId", "clienteId", "precio", "altaExigencia", "estilistaId", "estado", "horaFin"]) {
    assert.ok(!sentBody.includes(privateField));
  }
  assert.deepEqual(result, createdDto);
  assert.equal(result.estado, "activo");
  assert.ok(!JSON.stringify(result).includes("clienteId"));
});

test("crear turno: 409 slot/SaaS, 401 y otros errores conservan solo status/código seguro", async t => {
  for (const [status, code] of [
    [409, "PET_SLOT_UNAVAILABLE"],
    [409, "PET_BOOKING_UNAVAILABLE"],
    [401, "PET_SESSION_INVALID"],
  ] as const) {
    t.mock.method(globalThis, "fetch", async () => response({ error: code, message: context.token }, status));
    await assert.rejects(publicPetBookingService.crearTurno(context, { ...input, hora: "10:00" }), error => {
      assertPrivateError(error, status, code);
      return true;
    });
    t.mock.restoreAll();
  }
});

test("crear turno: 200 inesperado, estado incorrecto y shape inválido no cuentan como éxito", async t => {
  t.mock.method(globalThis, "fetch", async () => response(createdDto, 200));
  await assert.rejects(publicPetBookingService.crearTurno(context, { ...input, hora: "10:00" }), error => {
    assertPrivateError(error, 200, null);
    return true;
  });

  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => response({ ...createdDto, estado: "pendiente_pago" }, 201));
  await assert.rejects(publicPetBookingService.crearTurno(context, { ...input, hora: "10:00" }), error => {
    assertPrivateError(error, 201, null);
    return true;
  });
});

test("fetch: fallo de red queda sanitizado y abort de lectura se propaga intacto", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("RAW_NETWORK_PRIVATE_SENTINEL"); });
  await assert.rejects(publicPetBookingService.getOpcionesReserva(context, 1), error => {
    assertPrivateError(error, 0, null);
    assert.ok(!error.toString().includes("RAW_NETWORK_PRIVATE_SENTINEL"));
    return true;
  });

  t.mock.restoreAll();
  const controller = new AbortController();
  const aborted = new DOMException("aborted", "AbortError");
  t.mock.method(globalThis, "fetch", async () => { throw aborted; });
  await assert.rejects(publicPetBookingService.getDisponibilidad(context, input, { signal: controller.signal }), error => error === aborted);
});

test("respuesta HTML/error arbitrario no se copia al error tipado", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>RAW_PROXY_PRIVATE_SENTINEL</html>", { status: 502 }));
  await assert.rejects(publicPetBookingService.getOpcionesReserva(context, 1), error => {
    assertPrivateError(error, 502, null);
    assert.ok(!error.toString().includes("RAW_PROXY_PRIVATE_SENTINEL"));
    return true;
  });
});

test("ordenarExtraIds retorna copia ascendente y conserva duplicados para validación backend", () => {
  const original = [5, 3, 3];
  const normalized = ordenarExtraIds(original);
  assert.deepEqual(normalized, [3, 3, 5]);
  assert.notEqual(normalized, original);
  assert.deepEqual(original, [5, 3, 3]);
});
