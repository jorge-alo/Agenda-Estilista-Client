import assert from "node:assert/strict";
import { test } from "node:test";
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
