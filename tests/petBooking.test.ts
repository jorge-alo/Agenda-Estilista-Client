import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "../src/shared/lib/queryKeys.ts";
import {
  petBookingAvailabilityQuery, petBookingOptionsQuery, petBookingErrorKind, removePetBookingQueries,
  type ScopedPetBookingContext,
} from "../src/feature/publicPet/booking/publicPetBookingQueries.ts";
import { createPetBookingController } from "../src/feature/publicPet/booking/publicPetBookingController.ts";
import {
  ordenarExtraIds,
  publicPetBookingService,
} from "../src/feature/publicPet/services/publicPetBooking.service.ts";
import { PublicPetHttpError } from "../src/feature/publicPet/services/publicPetHttp.ts";
import {
  combinarPetBookingSuccess,
  crearEstadoInicialBooking,
  crearPetBookingSuccessBase,
  formatearFechaBookingArgentina,
  petBookingReducer,
  petBookingSelectionKey,
  togglePetBookingExtra,
  type PetBookingDraft,
  type PetBookingState,
} from "../src/feature/publicPet/booking/publicPetBookingState.ts";
import type {
  PetAvailabilityInput,
  PetAvailability,
  PetBookingOptions,
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

const pets = [{ id: 11, nombre: "Rocky" }, { id: 12, nombre: "Luna" }];
const opciones: PetBookingOptions = {
  servicios: [
    { id: 2, nombre: "Baño", duracionMinutos: 60 },
    { id: 4, nombre: "Corte", duracionMinutos: 45 },
  ],
  extras: [
    { id: 3, nombre: "Uñas", duracionExtraMinutos: 15 },
    { id: 5, nombre: "Perfume", duracionExtraMinutos: 10 },
  ],
};

function configuredState(): PetBookingState {
  let state = crearEstadoInicialBooking(pets);
  state = petBookingReducer(state, { type: "SET_MASCOTA", mascotaId: 11 });
  state = petBookingReducer(state, { type: "SET_SERVICIO", servicioId: 2 });
  state = petBookingReducer(state, { type: "TOGGLE_EXTRA", extraId: 5 });
  state = petBookingReducer(state, { type: "TOGGLE_EXTRA", extraId: 3 });
  state = petBookingReducer(state, { type: "SET_FECHA", fecha: "2026-10-25" });
  const key = petBookingSelectionKey(state.draft);
  assert.ok(key);
  return petBookingReducer(state, { type: "SET_SLOT", slot: { horaInicio: "10:00", horaFin: "11:25", selectionKey: key } });
}

function draftCopy(draft: PetBookingDraft): PetBookingDraft {
  return { ...draft, extraIds: [...draft.extraIds], slotSeleccionado: draft.slotSeleccionado && { ...draft.slotSeleccionado } };
}

test("estado inicial: cero, una y múltiples mascotas siguen la política explícita", () => {
  assert.deepEqual(crearEstadoInicialBooking([]).draft, {
    mascotaId: null, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null,
  });
  assert.equal(crearEstadoInicialBooking([pets[0]]).draft.mascotaId, 11);
  assert.equal(crearEstadoInicialBooking(pets).draft.mascotaId, null);
});

test("cambiar mascota resetea dependencias; volver a elegir el mismo ID no las altera", () => {
  const state = configuredState();
  const changed = petBookingReducer(state, { type: "SET_MASCOTA", mascotaId: 12 });
  assert.deepEqual(changed.draft, { mascotaId: 12, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null });
  assert.deepEqual(state.draft.extraIds, [3, 5], "el estado anterior sigue intacto");
  assert.equal(petBookingReducer(state, { type: "SET_MASCOTA", mascotaId: 11 }), state);
});

test("cambiar servicio conserva extras/mascota/fecha, pero siempre invalida slot", () => {
  const state = configuredState();
  const changed = petBookingReducer(state, { type: "SET_SERVICIO", servicioId: 4 });
  assert.equal(changed.draft.mascotaId, 11);
  assert.equal(changed.draft.servicioId, 4);
  assert.deepEqual(changed.draft.extraIds, [3, 5]);
  assert.equal(changed.draft.fecha, "2026-10-25");
  assert.equal(changed.draft.slotSeleccionado, null);
  assert.equal(petBookingReducer(changed, { type: "SET_SERVICIO", servicioId: 4 }), changed);
});

test("extras: add/remove, unicidad ASC, cap 100, rechazo indicado y sin mutación", () => {
  const original = [9, 3];
  const add = togglePetBookingExtra(original, 5);
  assert.deepEqual(add, { accepted: true, extraIds: [3, 5, 9] });
  assert.deepEqual(original, [9, 3]);
  assert.deepEqual(togglePetBookingExtra([5, 3], 3), { accepted: true, extraIds: [5] });
  assert.deepEqual(togglePetBookingExtra([3, 3, 5], 7), { accepted: true, extraIds: [3, 5, 7] });
  assert.deepEqual(togglePetBookingExtra([3], 0), { accepted: false, reason: "INVALID_ID" });
  const hundred = Array.from({ length: 100 }, (_, index) => index + 1);
  assert.deepEqual(togglePetBookingExtra(hundred, 101), { accepted: false, reason: "MAX_EXTRAS" });
  assert.equal(hundred.length, 100);
});

test("TOGGLE_EXTRA invalida slot, conserva selección y no modifica estado previo", () => {
  const state = configuredState();
  const changed = petBookingReducer(state, { type: "TOGGLE_EXTRA", extraId: 7 });
  assert.deepEqual(changed.draft.extraIds, [3, 5, 7]);
  assert.equal(changed.draft.slotSeleccionado, null);
  assert.deepEqual(state.draft.extraIds, [3, 5]);
  const before = { ...changed, draft: draftCopy(changed.draft) };
  assert.equal(petBookingReducer(changed, { type: "TOGGLE_EXTRA", extraId: 0 }), changed);
  assert.deepEqual(changed, before);
});

test("SET_FECHA conserva mascota/servicio/extras, limpia slot e ignora fecha inválida", () => {
  const state = configuredState();
  const changed = petBookingReducer(state, { type: "SET_FECHA", fecha: "2026-10-26" });
  assert.equal(changed.draft.mascotaId, 11);
  assert.equal(changed.draft.servicioId, 2);
  assert.deepEqual(changed.draft.extraIds, [3, 5]);
  assert.equal(changed.draft.slotSeleccionado, null);
  assert.equal(petBookingReducer(changed, { type: "SET_FECHA", fecha: "2026-02-30" }), changed);
  assert.equal(petBookingReducer(changed, { type: "SET_FECHA", fecha: "" }).draft.fecha, "");
});

test("selectionKey es determinista, ASC y depende solo de mascota/servicio/extras/fecha", () => {
  const one = { mascotaId: 11, servicioId: 2, extraIds: [5, 3], fecha: "2026-10-25", slotSeleccionado: null };
  const two = { ...one, extraIds: [3, 5] };
  assert.equal(petBookingSelectionKey(one), petBookingSelectionKey(two));
  assert.ok(!String(petBookingSelectionKey(one)).includes("token"));
  assert.ok(!String(petBookingSelectionKey(one)).includes("slug"));
  assert.notEqual(petBookingSelectionKey(one), petBookingSelectionKey({ ...one, fecha: "2026-10-26" }));
});

test("SET_SLOT solo acepta una hora válida para la selectionKey actual", () => {
  const state = configuredState();
  const key = petBookingSelectionKey(state.draft);
  assert.ok(key);
  const slot = { horaInicio: "11:00", horaFin: "12:25", selectionKey: key };
  const selected = petBookingReducer(state, { type: "SET_SLOT", slot });
  assert.deepEqual(selected.draft.slotSeleccionado, slot);
  assert.equal(petBookingReducer(selected, { type: "SET_SLOT", slot: { ...slot, selectionKey: "stale" } }), selected);
  assert.equal(petBookingReducer(selected, { type: "SET_SLOT", slot: { ...slot, horaInicio: "99:00" } }), selected);
});

test("cualquier cambio real de mascota/servicio/extras/fecha elimina la hora", () => {
  const state = configuredState();
  const actions = [
    { type: "SET_MASCOTA", mascotaId: 12 },
    { type: "SET_SERVICIO", servicioId: 4 },
    { type: "TOGGLE_EXTRA", extraId: 7 },
    { type: "SET_FECHA", fecha: "2026-10-26" },
  ] as const;
  for (const action of actions) assert.equal(petBookingReducer(state, action).draft.slotSeleccionado, null, action.type);
});

test("SLOT_CONFLICT solo limpia hora y publica el aviso aprobado", () => {
  const state = configuredState();
  const result = petBookingReducer(state, { type: "SLOT_CONFLICT" });
  assert.equal(result.draft.mascotaId, state.draft.mascotaId);
  assert.equal(result.draft.servicioId, state.draft.servicioId);
  assert.deepEqual(result.draft.extraIds, state.draft.extraIds);
  assert.equal(result.draft.fecha, state.draft.fecha);
  assert.equal(result.draft.slotSeleccionado, null);
  assert.equal(result.avisoRecuperable, "Ese horario acaba de dejar de estar disponible.");
});

test("BOOKING_UNAVAILABLE conserva el draft, bloquea slots y RETRY solo quita bloqueo/aviso", () => {
  const state = configuredState();
  const unavailable = petBookingReducer(state, { type: "BOOKING_UNAVAILABLE" });
  assert.equal(unavailable.bookingUnavailable, true);
  assert.equal(unavailable.draft.slotSeleccionado, null);
  assert.equal(unavailable.draft.mascotaId, state.draft.mascotaId);
  assert.equal(unavailable.draft.servicioId, state.draft.servicioId);
  assert.deepEqual(unavailable.draft.extraIds, state.draft.extraIds);
  assert.equal(unavailable.draft.fecha, state.draft.fecha);
  assert.equal(unavailable.avisoRecuperable, "Las reservas online no están disponibles en este momento.");
  const key = petBookingSelectionKey(unavailable.draft);
  assert.ok(key);
  assert.equal(petBookingReducer(unavailable, { type: "SET_SLOT", slot: { horaInicio: "11:00", horaFin: "12:00", selectionKey: key } }), unavailable);
  assert.equal(petBookingReducer(unavailable, {
    type: "SET_SUCCESS",
    success: { mascotaNombre: "Rocky", servicioNombre: "Baño", extras: [], fecha: "2026-10-25", duracionMinutos: 60,
      hora: "10:00", horaFin: "11:00", estado: "activo" },
  }), unavailable);
  const retry = petBookingReducer(unavailable, { type: "RETRY_BOOKING" });
  assert.equal(retry.bookingUnavailable, false);
  assert.equal(retry.avisoRecuperable, null);
  assert.equal(retry.draft.slotSeleccionado, null);
  assert.deepEqual(retry.draft, unavailable.draft);
});

test("reconciliar perfil conserva mascota vigente y no auto-selecciona una restante", () => {
  const state = configuredState();
  assert.equal(petBookingReducer(state, { type: "RECONCILE_PROFILE", mascotas: pets }), state);
  const disappeared = petBookingReducer(state, { type: "RECONCILE_PROFILE", mascotas: [pets[1]] });
  assert.deepEqual(disappeared.draft, { mascotaId: null, servicioId: null, extraIds: [], fecha: "", slotSeleccionado: null });
  assert.equal(disappeared.draft.mascotaId, null, "la única mascota restante no se auto-selecciona en una reconciliación");
});

test("reconciliar opciones no reemplaza servicio, filtra extras faltantes y limpia slot", () => {
  const state = configuredState();
  const refreshed: PetBookingOptions = {
    servicios: [{ id: 4, nombre: "Corte nuevo", duracionMinutos: 30 }],
    extras: [{ id: 5, nombre: "Perfume actualizado", duracionExtraMinutos: 12 }],
  };
  const reconciled = petBookingReducer(state, { type: "RECONCILE_OPTIONS", opciones: refreshed });
  assert.equal(reconciled.draft.servicioId, null, "no elige el servicio alternativo");
  assert.deepEqual(reconciled.draft.extraIds, [5]);
  assert.equal(reconciled.draft.mascotaId, 11);
  assert.equal(reconciled.draft.fecha, "2026-10-25");
  assert.equal(reconciled.draft.slotSeleccionado, null);
  assert.deepEqual(state.draft.extraIds, [3, 5]);
  assert.equal(petBookingReducer(reconciled, { type: "RECONCILE_OPTIONS", opciones: refreshed }), reconciled);
});

test("reconciliar extras múltiples conserva solo existentes en ASC", () => {
  const state = petBookingReducer(configuredState(), { type: "SET_SERVICIO", servicioId: 4 });
  const refreshed: PetBookingOptions = {
    servicios: opciones.servicios,
    extras: [{ id: 5, nombre: "Perfume", duracionExtraMinutos: 10 }, { id: 3, nombre: "Uñas", duracionExtraMinutos: 15 }],
  };
  const preserved = petBookingReducer(state, { type: "RECONCILE_OPTIONS", opciones: refreshed });
  assert.deepEqual(preserved.draft.extraIds, [3, 5]);
  assert.equal(preserved.draft.servicioId, 4);
  assert.equal(preserved.draft.slotSeleccionado, null);
});

test("snapshot de submit copia nombres/extras/duración y se combina con el 201 sin precio", () => {
  const state = configuredState();
  const snapshotPets = pets.map(pet => ({ ...pet }));
  const snapshotOptions: PetBookingOptions = {
    servicios: opciones.servicios.map(service => ({ ...service })),
    extras: opciones.extras.map(extra => ({ ...extra })),
  };
  const disponibilidad: PetAvailability = {
    fecha: "2026-10-25", duracionMinutos: 85,
    slots: [{ horaInicio: "10:00", horaFin: "11:25" }],
  };
  const snapshot = crearPetBookingSuccessBase(state.draft, snapshotPets, snapshotOptions, disponibilidad);
  assert.ok(snapshot);
  assert.deepEqual(snapshot, {
    mascotaNombre: "Rocky", servicioNombre: "Baño",
    extras: [{ id: 3, nombre: "Uñas" }, { id: 5, nombre: "Perfume" }],
    fecha: "2026-10-25", duracionMinutos: 85,
  });

  snapshotPets[0].nombre = "Nombre cambiado después";
  snapshotOptions.servicios[0].nombre = "Servicio cambiado después";
  snapshotOptions.extras[0].nombre = "Extra cambiado después";
  assert.equal(snapshot.mascotaNombre, "Rocky");
  assert.equal(snapshot.servicioNombre, "Baño");
  assert.equal(snapshot.extras[0].nombre, "Uñas");

  const success = combinarPetBookingSuccess(snapshot, {
    id: 900, fecha: "2026-10-25", hora: "10:00", horaFin: "11:30", estado: "activo",
  });
  assert.deepEqual(success, {
    ...snapshot, hora: "10:00", horaFin: "11:30", estado: "activo",
  });
  assert.ok(!JSON.stringify(success).includes("precio"));
  assert.ok(!("id" in success));
});

test("success requiere slot de la disponibilidad y la selectionKey actual", () => {
  const state = configuredState();
  const availability: PetAvailability = { fecha: "2026-10-25", duracionMinutos: 85, slots: [] };
  assert.equal(crearPetBookingSuccessBase(state.draft, pets, opciones, availability), null);
  const changed = petBookingReducer(state, { type: "SET_FECHA", fecha: "2026-10-26" });
  assert.equal(crearPetBookingSuccessBase(changed.draft, pets, opciones, availability), null);
});

test("START_NEW_BOOKING limpia draft/avisos/success y solo auto-selecciona cuando hay una mascota", () => {
  let state = petBookingReducer(configuredState(), { type: "SLOT_CONFLICT" });
  state = petBookingReducer(state, {
    type: "SET_SUCCESS",
    success: { mascotaNombre: "Rocky", servicioNombre: "Baño", extras: [], fecha: "2026-10-25", duracionMinutos: 60,
      hora: "10:00", horaFin: "11:00", estado: "activo" },
  });
  const multiple = petBookingReducer(state, { type: "START_NEW_BOOKING", mascotas: pets });
  assert.equal(multiple.draft.mascotaId, null);
  assert.equal(multiple.draft.servicioId, null);
  assert.deepEqual(multiple.draft.extraIds, []);
  assert.equal(multiple.draft.fecha, "");
  assert.equal(multiple.draft.slotSeleccionado, null);
  assert.equal(multiple.avisoRecuperable, null);
  assert.equal(multiple.success, null);
  const single = petBookingReducer(state, { type: "START_NEW_BOOKING", mascotas: [pets[1]] });
  assert.equal(single.draft.mascotaId, 12);
  assert.equal(single.draft.servicioId, null);
});

test("formato argentino se deriva de componentes y no desplaza la fecha por UTC", () => {
  assert.equal(formatearFechaBookingArgentina("2026-10-25"), "25/10/2026");
  assert.equal(formatearFechaBookingArgentina("2024-02-29"), "29/02/2024");
  assert.equal(formatearFechaBookingArgentina("2026-02-30"), "");
  assert.equal(formatearFechaBookingArgentina(""), "");
});

const scopedContext: ScopedPetBookingContext = { ...context, sessionScope: "session-instance-a" };
const queryOptionsDto = {
  servicios: [{ id: 2, nombre: "Baño", duracionMinutos: 90 }],
  extras: [{ id: 3, nombre: "Uñas", duracionExtraMinutos: 15 }, { id: 5, nombre: "Perfume", duracionExtraMinutos: 15 }],
};
type BookingController = ReturnType<typeof createPetBookingController>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function until<T>(get: () => T, subscribe: (changed: () => void) => () => void, predicate: (value: T) => boolean): Promise<T> {
  if (predicate(get())) return get();
  return new Promise<T>((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error("BOOKING_TEST_WATCHDOG")); }, 5000);
    unsubscribe = subscribe(() => {
      const value = get();
      if (predicate(value)) {
        clearTimeout(timeout);
        queueMicrotask(() => unsubscribe());
        resolve(value);
      }
    });
  });
}

function testClient(t: TestContext) {
  const client = new QueryClient();
  t.after(() => client.clear());
  return client;
}

function testController(t: TestContext, client: QueryClient, auth = scopedContext) {
  const controller = createPetBookingController(client, auth);
  controller.setProfile({ mascotas: [{ id: 1, nombre: "Rocky" }] });
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => { unsubscribe(); controller.dispose(); });
  return controller;
}

function waitBooking(controller: BookingController, predicate: (value: ReturnType<BookingController["getSnapshot"]>) => boolean) {
  return until(controller.getSnapshot, controller.subscribe, predicate);
}

async function readyToConfirm(controller: BookingController) {
  await waitBooking(controller, value => value.options.isSuccess && !value.options.isFetching);
  controller.setServicio(2);
  controller.toggleExtra(5);
  controller.toggleExtra(3);
  controller.setFecha("2026-10-25");
  await waitBooking(controller, value => value.availability.isSuccess && !value.availability.isFetching);
  const key = petBookingSelectionKey(controller.getSnapshot().state.draft);
  assert.ok(key);
  controller.setSlot({ ...availabilityDto.slots[0], selectionKey: key });
  assert.equal(controller.getSnapshot().canConfirm, true);
}

test("Query keys: slug/scope aíslan cache, extras son order-independent y no hay Bearer/PII", () => {
  const a = queryKeys.petBooking.availability(context.slug, "scope-a", 1, 2, [5, 3], "2026-10-25");
  const b = queryKeys.petBooking.availability(context.slug, "scope-a", 1, 2, [3, 5], "2026-10-25");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, queryKeys.petBooking.availability(context.slug, "scope-b", 1, 2, [3, 5], "2026-10-25"));
  assert.notDeepEqual(a, queryKeys.petBooking.availability("other", "scope-a", 1, 2, [3, 5], "2026-10-25"));
  assert.ok(!JSON.stringify(petBookingOptionsQuery(scopedContext, 1).queryKey).includes(context.token));
  assert.ok(!JSON.stringify(a).includes("nombre"));
  assert.ok(!JSON.stringify(a).includes("clienteId"));
});

test("Query options: enabled por contexto/mascota, configuración sin retry/refetch/placeholder", () => {
  const enabled = petBookingOptionsQuery(scopedContext, 1);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.retry, false);
  assert.equal(enabled.refetchOnWindowFocus, false);
  assert.equal(enabled.refetchOnReconnect, false);
  assert.equal(enabled.staleTime, 0);
  assert.equal(enabled.gcTime, 0);
  assert.equal(enabled.placeholderData, undefined);
  for (const auth of [{ ...scopedContext, slug: "" }, { ...scopedContext, token: "" }, { ...scopedContext, sessionScope: "" }]) {
    assert.equal(petBookingOptionsQuery(auth, 1).enabled, false);
  }
  assert.equal(petBookingOptionsQuery(scopedContext, null).enabled, false);
  assert.equal(petBookingOptionsQuery(scopedContext, 0).enabled, false);
  assert.equal(petBookingOptionsQuery(scopedContext, 1, false).enabled, false);
});

test("Query disponibilidad: solo selección completa; [] válido, keys cambian por servicio/extras/fecha", () => {
  const complete = { ...input, extraIds: [] };
  const baseline = petBookingAvailabilityQuery(scopedContext, complete);
  assert.equal(baseline.enabled, true);
  assert.equal(baseline.retry, false);
  assert.equal(baseline.gcTime, 0);
  assert.equal(baseline.placeholderData, undefined);
  assert.equal(petBookingAvailabilityQuery(scopedContext, null).enabled, false);
  for (const invalid of [{ ...complete, mascotaId: 0 }, { ...complete, servicioId: 0 }, { ...complete, fecha: "" }, { ...complete, fecha: "2026-02-30" }]) {
    assert.equal(petBookingAvailabilityQuery(scopedContext, invalid).enabled, false);
  }
  for (const changed of [{ ...complete, servicioId: 3 }, { ...complete, extraIds: [3] }, { ...complete, fecha: "2026-10-26" }]) {
    assert.notDeepEqual(petBookingAvailabilityQuery(scopedContext, changed).queryKey, baseline.queryKey);
  }
});

test("QueryObserver opciones: request exacto con signal, sin reutilizar mascota anterior", async t => {
  const client = testClient(t);
  const second = deferred<Response>();
  const secondStarted = deferred<void>();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/mascotas/2/")) { secondStarted.resolve(); return second.promise; }
    return Promise.resolve(response(queryOptionsDto));
  });
  const observer = new QueryObserver(client, petBookingOptionsQuery(scopedContext, 1));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => unsubscribe());
  await until(() => observer.getCurrentResult(), callback => observer.subscribe(callback), value => value.isSuccess);
  observer.setOptions(petBookingOptionsQuery(scopedContext, 2));
  await secondStarted.promise;
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(calls[0].url, "/api/pet/public/local%2Fa/mascotas/1/opciones-reserva");
  assert.equal(calls[0].init?.method, "GET");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.deepEqual(calls[0].init?.headers, { Authorization: `Bearer ${context.token}` });
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
  second.resolve(response({ servicios: [], extras: [] }));
  const result = await until(() => observer.getCurrentResult(), callback => observer.subscribe(callback), value => value.isSuccess);
  assert.deepEqual(result.data, { servicios: [], extras: [] });
});

test("QueryObserver sin retry: una respuesta 500 dispara exactamente un request", async t => {
  const client = testClient(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return response({ code: "INTERNAL_SERVER_ERROR" }, 500); });
  const observer = new QueryObserver(client, petBookingOptionsQuery(scopedContext, 1));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => unsubscribe());
  await until(() => observer.getCurrentResult(), callback => observer.subscribe(callback), value => value.isError);
  assert.equal(calls, 1);
  assert.equal(observer.getCurrentResult().failureCount, 1);
});

test("QueryObserver disponibilidad: aborta A, B gana y A tardía no reaparece como B", async t => {
  const client = testClient(t);
  const first = deferred<Response>();
  const second = deferred<Response>();
  const startedA = deferred<void>();
  const startedB = deferred<void>();
  let signalA: AbortSignal | undefined;
  const payloads: unknown[] = [];
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    payloads.push(payload);
    if (payload.fecha === input.fecha) {
      signalA = init?.signal ?? undefined;
      startedA.resolve();
      return first.promise; // Deliberately ignores abort to emulate a late wire response.
    }
    startedB.resolve();
    return second.promise;
  });
  const observer = new QueryObserver(client, petBookingAvailabilityQuery(scopedContext, input));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => unsubscribe());
  await startedA.promise;
  observer.setOptions(petBookingAvailabilityQuery(scopedContext, { ...input, fecha: "2026-10-26" }));
  await startedB.promise;
  assert.equal(signalA?.aborted, true);
  assert.equal(observer.getCurrentResult().data, undefined);
  second.resolve(response({ ...availabilityDto, fecha: "2026-10-26" }));
  await until(() => observer.getCurrentResult(), callback => observer.subscribe(callback), value => value.isSuccess);
  first.resolve(response(availabilityDto));
  await nextTick();
  assert.equal(observer.getCurrentResult().data?.fecha, "2026-10-26");
  assert.deepEqual(payloads[0], { mascotaId: 1, servicioId: 2, extraIds: [3, 5], fecha: "2026-10-25" });
});

test("controller mutation: doble submit síncrono hace un POST y éxito usa snapshot + 201 real", async t => {
  const client = testClient(t);
  const created = deferred<Response>();
  const posted = deferred<void>();
  let posts = 0;
  let sent: unknown;
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/turnos")) { posts++; sent = JSON.parse(String(init?.body)); posted.resolve(); return created.promise; }
    return Promise.resolve(response(String(url).endsWith("/disponibilidad") ? availabilityDto : queryOptionsDto));
  });
  const controller = testController(t, client);
  await readyToConfirm(controller);
  const first = controller.confirmar();
  const duplicate = controller.confirmar();
  assert.equal(await duplicate, "ignored");
  await posted.promise;
  controller.setFecha("2026-10-26");
  assert.equal(controller.getSnapshot().state.draft.fecha, input.fecha, "selección no cambia durante POST");
  controller.setProfile({ mascotas: [{ id: 1, nombre: "Nombre posterior" }] });
  const cached = client.getQueryData(petBookingOptionsQuery(scopedContext, 1).queryKey);
  assert.ok(cached);
  cached.servicios[0].nombre = "Servicio posterior";
  cached.extras[0].nombre = "Extra posterior";
  created.resolve(response({ ...createdDto, hora: "10:00", horaFin: "12:30" }, 201));
  assert.equal(await first, "created");
  assert.equal(posts, 1);
  assert.deepEqual(sent, { mascotaId: 1, servicioId: 2, extraIds: [3, 5], fecha: "2026-10-25", hora: "10:00" });
  assert.deepEqual(controller.getSnapshot().state.success, {
    mascotaNombre: "Rocky", servicioNombre: "Baño", extras: [{ id: 3, nombre: "Uñas" }, { id: 5, nombre: "Perfume" }],
    fecha: "2026-10-25", duracionMinutos: 120, hora: "10:00", horaFin: "12:30", estado: "activo",
  });
  assert.ok(!JSON.stringify(client.getMutationCache().getAll().map(m => ({ key: m.options.mutationKey, variables: m.state.variables }))).includes(context.token));
});

test("mutation no retry: 500 conserva error remoto sin crear un segundo turno", async t => {
  const client = testClient(t);
  let posts = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turnos")) { posts++; return response({ code: "INTERNAL_SERVER_ERROR" }, 500); }
    return response(String(url).endsWith("/disponibilidad") ? availabilityDto : queryOptionsDto);
  });
  const controller = testController(t, client);
  await readyToConfirm(controller);
  assert.equal(await controller.confirmar(), "error");
  assert.equal(posts, 1);
  assert.ok(controller.getSnapshot().creation.error instanceof PublicPetHttpError);
  assert.equal(controller.getSnapshot().state.success, null);
  assert.equal(client.getMutationCache().getAll()[0].options.retry, false);
});

test("slot conflict: conserva selección, limpia hora y refetchea exactamente disponibilidad sin repetir POST", async t => {
  const client = testClient(t);
  let reads = 0;
  let posts = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turnos")) { posts++; return response({ error: "PET_SLOT_UNAVAILABLE" }, 409); }
    if (String(url).endsWith("/disponibilidad")) {
      reads++;
      return response(reads === 1 ? availabilityDto : { ...availabilityDto, slots: [{ horaInicio: "11:00", horaFin: "13:00" }] });
    }
    return response(queryOptionsDto);
  });
  const controller = testController(t, client);
  await readyToConfirm(controller);
  const before = controller.getSnapshot().state.draft;
  assert.equal(await controller.confirmar(), "error");
  assert.deepEqual(controller.getSnapshot().state.draft, { ...before, slotSeleccionado: null });
  assert.equal(controller.getSnapshot().state.avisoRecuperable, "Ese horario acaba de dejar de estar disponible.");
  assert.deepEqual(controller.getSnapshot().availability.data?.slots, [{ horaInicio: "11:00", horaFin: "13:00" }]);
  assert.equal(reads, 2);
  assert.equal(posts, 1);
});

for (const phase of ["options", "availability", "creation"] as const) {
  test(`booking unavailable desde ${phase}: bloquea lecturas hasta RETRY, sin logout`, async t => {
    const client = testClient(t);
    let allowed = false;
    let reads = 0;
    let posts = 0;
    const invalidations: unknown[] = [];
    t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
      const path = String(url);
      const currentPhase = path.endsWith("/turnos") ? "creation" : path.endsWith("/disponibilidad") ? "availability" : "options";
      if (currentPhase === "creation") posts++; else reads++;
      if (!allowed && currentPhase === phase) return response({ error: "PET_BOOKING_UNAVAILABLE" }, 409);
      return response(currentPhase === "creation" ? createdDto : currentPhase === "availability" ? availabilityDto : queryOptionsDto,
        currentPhase === "creation" ? 201 : 200);
    });
    const controller = testController(t, client);
    controller.setOnSessionInvalid(value => invalidations.push(value));
    if (phase === "creation") { await readyToConfirm(controller); await controller.confirmar(); }
    else if (phase === "availability") {
      await waitBooking(controller, value => value.options.isSuccess);
      controller.setServicio(2);
      controller.setFecha(input.fecha);
    }
    await waitBooking(controller, value => value.state.bookingUnavailable);
    const before = reads;
    controller.setFecha("2026-10-26");
    controller.toggleExtra(3);
    await nextTick();
    assert.equal(reads, before);
    assert.equal(controller.getSnapshot().availability.data, undefined);
    assert.equal(await controller.confirmar(), "ignored");
    assert.deepEqual(invalidations, []);
    allowed = true;
    controller.retryBooking();
    await waitBooking(controller, value => !value.state.bookingUnavailable && value.options.isSuccess);
    assert.ok(reads > before);
    assert.equal(posts, phase === "creation" ? 1 : 0, "retry del gate no reenvía creación");
  });
}

test("401: evento una sola vez con slug/scope, sin token ni acceso a storage", async t => {
  const client = testClient(t);
  const events: unknown[] = [];
  t.mock.method(globalThis, "fetch", async () => response({ error: "PET_SESSION_INVALID" }, 401));
  const controller = createPetBookingController(client, scopedContext);
  t.after(() => controller.dispose());
  controller.setProfile({ mascotas: [{ id: 1, nombre: "Rocky" }] });
  controller.setOnSessionInvalid(value => events.push(value));
  const unsubscribe = controller.subscribe(() => {});
  t.after(() => unsubscribe());
  await waitBooking(controller, value => value.sessionInvalid);
  assert.deepEqual(events, [{ slug: context.slug, sessionScope: scopedContext.sessionScope }]);
  assert.equal(await controller.confirmar(), "ignored");
});

test("401 tardío de scope A no emite invalidación ni afecta a scope B", async t => {
  const client = testClient(t);
  const late = deferred<Response>();
  const started = deferred<void>();
  const events: unknown[] = [];
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.headers as Record<string, string>).Authorization === `Bearer ${context.token}`) { started.resolve(); return late.promise; }
    return Promise.resolve(response(queryOptionsDto));
  });
  const a = testController(t, client);
  a.setOnSessionInvalid(value => events.push(value));
  await started.promise;
  a.dispose();
  const bContext = { ...scopedContext, sessionScope: "session-instance-b", token: "SESSION_B_PRIVATE_SENTINEL" };
  const b = testController(t, client, bContext);
  b.setOnSessionInvalid(value => events.push(value));
  await waitBooking(b, value => value.options.isSuccess);
  late.resolve(response({ error: "PET_SESSION_INVALID" }, 401));
  await nextTick();
  assert.deepEqual(events, []);
  assert.equal(b.getSnapshot().sessionInvalid, false);
  assert.equal(b.getSnapshot().options.isSuccess, true);
});

for (const code of ["PET_MASCOTA_UNAVAILABLE", "PET_SERVICE_UNAVAILABLE", "PET_EXTRA_UNAVAILABLE"] as const) {
  test(`404 ${code}: queda diferenciable sin refetch /me ni logout`, async t => {
    const client = testClient(t);
    let requests = 0;
    t.mock.method(globalThis, "fetch", async () => { requests++; return response({ error: code }, 404); });
    const controller = testController(t, client);
    await waitBooking(controller, value => value.options.isError);
    assert.ok(controller.getSnapshot().options.error instanceof PublicPetHttpError);
    assert.equal((controller.getSnapshot().options.error as PublicPetHttpError).code, code);
    assert.notEqual(petBookingErrorKind(controller.getSnapshot().options.error), "other");
    assert.equal(requests, 1);
    assert.equal(controller.getSnapshot().sessionInvalid, false);
  });
}

test("limpieza: solo elimina slug+scope indicado y cancela requests activos de ese scope", async t => {
  const client = testClient(t);
  const a = queryKeys.petBooking.options("local-a", "scope-a", 1);
  const sameSlug = queryKeys.petBooking.options("local-a", "scope-b", 1);
  const otherSlug = queryKeys.petBooking.options("local-b", "scope-a", 1);
  client.setQueryData(a, queryOptionsDto);
  client.setQueryData(sameSlug, queryOptionsDto);
  client.setQueryData(otherSlug, queryOptionsDto);
  const pending = deferred<Response>();
  const started = deferred<void>();
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    started.resolve();
    return pending.promise;
  });
  const observer = new QueryObserver(client, petBookingOptionsQuery({ ...scopedContext, slug: "local-a", sessionScope: "scope-a" }, 1));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => unsubscribe());
  await started.promise;
  await removePetBookingQueries(client, { slug: "local-a", sessionScope: "scope-a" });
  assert.equal(signal?.aborted, true);
  assert.equal(client.getQueryData(a), undefined);
  assert.deepEqual(client.getQueryData(sameSlug), queryOptionsDto);
  assert.deepEqual(client.getQueryData(otherSlug), queryOptionsDto);
  pending.resolve(response(queryOptionsDto));
  await nextTick();
  assert.equal(client.getQueryData(a), undefined);
});

test("query deshabilitada no hace request; disponibilidad con [] se consulta normalmente", async t => {
  const client = testClient(t);
  let requests = 0;
  let payload: unknown;
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    payload = JSON.parse(String(init?.body));
    return response(availabilityDto);
  });
  const c = new QueryObserver(client, petBookingOptionsQuery({ ...scopedContext, token: "" }, 1));
  const d = new QueryObserver(client, petBookingAvailabilityQuery(scopedContext, null));
  const stopC = c.subscribe(() => {});
  const stopD = d.subscribe(() => {});
  t.after(() => { stopC(); stopD(); });
  await nextTick();
  assert.equal(requests, 0);
  d.setOptions(petBookingAvailabilityQuery(scopedContext, { ...input, extraIds: [] }));
  await until(() => d.getCurrentResult(), changed => d.subscribe(changed), result => result.isSuccess);
  assert.equal(requests, 1);
  assert.deepEqual(payload, { mascotaId: 1, servicioId: 2, extraIds: [], fecha: input.fecha });
});

test("200 tardío de disponibilidad no levanta BOOKING_UNAVAILABLE disparado por opciones", async t => {
  const client = testClient(t);
  const oldAvailability = deferred<Response>();
  const availabilityStarted = deferred<void>();
  let catalogCalls = 0;
  let requests = 0;
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    if (String(url).endsWith("/disponibilidad")) {
      signal = init?.signal ?? undefined;
      availabilityStarted.resolve();
      return oldAvailability.promise;
    }
    catalogCalls++;
    return Promise.resolve(catalogCalls === 1 ? response(queryOptionsDto) : response({ error: "PET_BOOKING_UNAVAILABLE" }, 409));
  });
  const controller = testController(t, client);
  await waitBooking(controller, value => value.options.isSuccess);
  controller.setServicio(2);
  controller.setFecha(input.fecha);
  await availabilityStarted.promise;
  await controller.refetchOptions();
  assert.equal(controller.getSnapshot().state.bookingUnavailable, true);
  assert.equal(signal?.aborted, true);
  const before = requests;
  oldAvailability.resolve(response(availabilityDto));
  await nextTick();
  assert.equal(controller.getSnapshot().state.bookingUnavailable, true);
  assert.equal(controller.getSnapshot().availability.data, undefined);
  assert.equal(await controller.refetchAvailability(), undefined);
  assert.equal(requests, before);
});

test("mutation 401 tardía de A tras dispose no invalida la sesión B", async t => {
  const client = testClient(t);
  const pending = deferred<Response>();
  const posted = deferred<void>();
  const invalidations: unknown[] = [];
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL) => {
    if (String(url).endsWith("/turnos")) { posted.resolve(); return pending.promise; }
    return Promise.resolve(response(String(url).endsWith("/disponibilidad") ? availabilityDto : queryOptionsDto));
  });
  const a = testController(t, client);
  a.setOnSessionInvalid(value => invalidations.push(value));
  await readyToConfirm(a);
  const creating = a.confirmar();
  await posted.promise;
  a.dispose();
  const b = testController(t, client, { ...scopedContext, token: "PRIVATE_SESSION_B", sessionScope: "scope-b" });
  b.setOnSessionInvalid(value => invalidations.push(value));
  await waitBooking(b, value => value.options.isSuccess);
  pending.resolve(response({ error: "PET_SESSION_INVALID" }, 401));
  assert.equal(await creating, "error");
  assert.deepEqual(invalidations, []);
  assert.equal(b.getSnapshot().sessionInvalid, false);
  assert.equal(b.getSnapshot().options.isSuccess, true);
});

test("controller reutiliza reducer para reconciliar opciones/perfil sin consultar /me", async t => {
  const client = testClient(t);
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return response(String(url).endsWith("/disponibilidad") ? availabilityDto : queryOptionsDto);
  });
  const controller = testController(t, client);
  await readyToConfirm(controller);
  controller.reconcileOptions(999, { servicios: [], extras: [] });
  assert.equal(controller.getSnapshot().state.draft.servicioId, 2, "ignora datos de otra mascota");
  controller.reconcileOptions(1, { servicios: [], extras: [queryOptionsDto.extras[0]] });
  assert.equal(controller.getSnapshot().state.draft.servicioId, null);
  assert.deepEqual(controller.getSnapshot().state.draft.extraIds, [3]);
  assert.equal(controller.getSnapshot().state.draft.slotSeleccionado, null);
  controller.setProfile({ mascotas: [{ id: 9, nombre: "Nueva mascota" }] });
  assert.equal(controller.getSnapshot().state.draft.mascotaId, null, "no auto-selecciona el reemplazo");
  assert.ok(urls.every(url => !url.includes("/session/")));
});

test("orquestación no accede a storage y reconecta tras limpieza de suscripción (StrictMode)", async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  let storageReads = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { storageReads++; throw new Error("STORAGE_NOT_ALLOWED"); },
    get sessionStorage() { storageReads++; throw new Error("STORAGE_NOT_ALLOWED"); },
  } });
  const client = testClient(t);
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) =>
    response(String(url).endsWith("/disponibilidad") ? availabilityDto : queryOptionsDto));
  const controller = createPetBookingController(client, scopedContext);
  try {
    controller.setProfile({ mascotas: [{ id: 1, nombre: "Rocky" }] });
    const first = controller.subscribe(() => {});
    first();
    const second = controller.subscribe(() => {});
    await waitBooking(controller, value => value.options.isSuccess);
    assert.equal(controller.getSnapshot().state.draft.mascotaId, 1);
    assert.equal(storageReads, 0);
    second();
  } finally {
    controller.dispose();
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete (globalThis as { window?: unknown }).window;
  }
});
