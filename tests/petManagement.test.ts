import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

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

const { PetManagementApiError, petManagementService } = await import(
  "../src/feature/admin/petManagement/services/petManagement.service.ts"
);
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const {
  petManagementDetailQuery,
  petManagementSearchQuery,
} = await import("../src/feature/admin/petManagement/queries/petManagementQueries.ts");
const {
  PET_MANAGEMENT_SEARCH_DEBOUNCE_MS,
  PET_MANAGEMENT_SEARCH_LIMIT,
} = await import("../src/feature/admin/petManagement/types/petManagement.types.ts");
const {
  petManagementInitialState,
  petManagementNormalizedTerm,
  petManagementReducer,
  petManagementSearchInputState,
  petManagementSearchRequestTerm,
} = await import("../src/feature/admin/petManagement/state/petManagementState.ts");
const {
  PET_MANAGEMENT_LIMIT_MESSAGE,
  PET_MANAGEMENT_UNAVAILABLE_MESSAGE,
  petManagementDateLabel,
  petManagementDetailErrorMessage,
  petManagementErrorKind,
  petManagementFlagLabel,
  petManagementResultMeta,
  petManagementSearchErrorMessage,
  petManagementShowsLimitCopy,
  petManagementText,
} = await import("../src/feature/admin/petManagement/components/petManagementView.ts");
const {
  getPetAdminContentKind,
  isWidePetAdminContent,
} = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");
const { BUSINESS_TYPE } = await import("../src/shared/types/businessType.ts");

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(t: TestContext, handler: (url: string, init?: RequestInit) => Promise<Response>) {
  storage.set("token", "ADMIN_JWT_TEST_SENTINEL");
  t.mock.method(globalThis, "fetch", (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
}

async function waitFor(condition: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timeout");
    await nextTick();
  }
}

function searchDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 6059,
    nombre: "Firulais",
    raza: null,
    activo: 1,
    responsables: [
      { id: 7001, nombre: "Ana", telefono: "11 2345-6789" },
    ],
    ...overrides,
  };
}

function detailDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 6059,
    local_id: 5532,
    nombre: "Firulais",
    raza: "Mestizo",
    fecha_nacimiento: "2021-03-04",
    sexo: "Macho",
    tamano: "Mediano",
    tipo_pelo: "Corto",
    observaciones: "",
    alta_exigencia: 1,
    reserva_online_habilitada: 0,
    activo: 1,
    created_at: "2026-10-19 10:00:00",
    updated_at: "2026-10-19 10:00:00",
    responsables: [
      { id: 7001, nombre: "Ana", telefono: "11 2345-6789", local_id: 5532, created_at: "ignored" },
    ],
    ...overrides,
  };
}

test("search: GET exacto con q, limit, estado, JWT, no-store, signal y activo proyectado", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response([searchDto({ local_id: 5532, reserva_online_habilitada: 1, created_at: "ignored" })]);
  });

  const q = "Firúláis & +54 %_\\";
  const result = await petManagementService.buscarMascotas({ q, estado: "todas", signal });
  assert.equal(request?.url, `/api/pet/admin/mascotas/search?${new URLSearchParams({ q, limit: "20", estado: "todas" })}`);
  assert.equal(request?.init?.method, "GET");
  assert.equal(request?.init?.cache, "no-store");
  assert.equal(request?.init?.signal, signal);
  assert.equal(new Headers(request?.init?.headers).get("Authorization"), "Bearer ADMIN_JWT_TEST_SENTINEL");
  assert.deepEqual(result, [{
    id: 6059,
    nombre: "Firulais",
    raza: null,
    activo: true,
    responsables: [{ id: 7001, nombre: "Ana", telefono: "11 2345-6789" }],
  }]);
});

test("search: limit explícito, estado inactivas, activo=0 y vacío válido", async t => {
  let url = "";
  mockFetch(t, async requestUrl => {
    url = requestUrl;
    return response([searchDto({ activo: 0 })]);
  });
  const result = await petManagementService.buscarMascotas({ q: "Luna", estado: "inactivas", limit: 5 });
  assert.equal(url, "/api/pet/admin/mascotas/search?q=Luna&limit=5&estado=inactivas");
  assert.equal(result[0].activo, false);
  mockFetch(t, async requestUrl => { url = requestUrl; return response([]); });
  assert.deepEqual(await petManagementService.buscarMascotas({ q: "", estado: "todas" }), []);
  assert.equal(url, "/api/pet/admin/mascotas/search?q=&limit=20&estado=todas");
});

test("search: parser estricto rechaza arrays, IDs, raza, activo y responsables inválidos", async t => {
  for (const payload of [
    {},
    [null],
    [searchDto({ id: "6059" })],
    [searchDto({ id: 0 })],
    [searchDto({ nombre: null })],
    [searchDto({ raza: undefined })],
    [searchDto({ raza: 7 })],
    [searchDto({ activo: true })],
    [searchDto({ activo: 2 })],
    [searchDto({ activo: null })],
    [searchDto({ responsables: null })],
    [searchDto({ responsables: [{}] })],
    [searchDto({ responsables: [{ id: 7001, nombre: "Ana", telefono: 1123456789 }] })],
  ]) {
    mockFetch(t, async () => response(payload));
    await assert.rejects(petManagementService.buscarMascotas({ q: "firu", estado: "todas" }), error => {
      assert.ok(error instanceof PetManagementApiError);
      assert.equal(error.status, 200);
      assert.equal(error.code, null);
      return true;
    });
  }
});

test("search: errores HTTP conservan status/code allowlisted sin copiar el mensaje remoto", async t => {
  for (const [status, code, remoteMessage] of [
    [400, "PET_MASCOTA_SEARCH_INVALID", "REMOTE_INTERNAL_SENTINEL"],
    [400, "UNKNOWN_REMOTE_CODE", "REMOTE_INTERNAL_SENTINEL"],
    [403, null, "REMOTE_INTERNAL_SENTINEL"],
    [404, null, "REMOTE_INTERNAL_SENTINEL"],
    [500, null, "REMOTE_INTERNAL_SENTINEL"],
  ] as const) {
    mockFetch(t, async () => response({ error: remoteMessage, ...(code ? { code } : {}) }, status));
    await assert.rejects(petManagementService.buscarMascotas({ q: "fi", estado: "todas" }), error => {
      assert.ok(error instanceof PetManagementApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code === "PET_MASCOTA_SEARCH_INVALID" ? code : null);
      assert.ok(!error.message.includes(remoteMessage));
      return true;
    });
  }
});

test("search: AbortSignal cancela la lectura sin convertir AbortError", async t => {
  const controller = new AbortController();
  mockFetch(t, async (_url, init) => new Promise<Response>((_resolve, reject) => {
    assert.equal(init?.signal, controller.signal);
    init?.signal?.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  }));
  const pending = petManagementService.buscarMascotas({ q: "firu", estado: "todas", signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error === controller.signal.reason);
});

test("detalle: ID en path, flags booleanos, campos y responsables proyectados", async t => {
  const signal = new AbortController().signal;
  let request: { url: string; init?: RequestInit } | undefined;
  mockFetch(t, async (url, init) => {
    request = { url, init };
    return response(detailDto());
  });
  const result = await petManagementService.obtenerMascota(6059, { signal });
  assert.equal(request?.url, "/api/pet/admin/mascotas/6059");
  assert.equal(request?.init?.signal, signal);
  assert.deepEqual(result, {
    id: 6059,
    nombre: "Firulais",
    raza: "Mestizo",
    fechaNacimiento: "2021-03-04",
    sexo: "Macho",
    tamano: "Mediano",
    tipoPelo: "Corto",
    observaciones: "",
    activo: true,
    altaExigencia: true,
    reservaOnlineHabilitada: false,
    responsables: [{ id: 7001, nombre: "Ana", telefono: "11 2345-6789" }],
  });
});

test("detalle: parser estricto rechaza flags, fechas, textos y responsables inválidos", async t => {
  for (const payload of [
    {},
    detailDto({ id: 0 }),
    detailDto({ nombre: null }),
    detailDto({ raza: 7 }),
    detailDto({ fecha_nacimiento: "2021-02-30" }),
    detailDto({ fecha_nacimiento: 20210304 }),
    detailDto({ sexo: 7 }),
    detailDto({ tamano: 7 }),
    detailDto({ tipo_pelo: false }),
    detailDto({ observaciones: 7 }),
    detailDto({ activo: true }),
    detailDto({ alta_exigencia: 2 }),
    detailDto({ reserva_online_habilitada: null }),
    detailDto({ responsables: null }),
    detailDto({ responsables: [{ id: 7001, nombre: "Ana" }] }),
  ]) {
    mockFetch(t, async () => response(payload));
    await assert.rejects(petManagementService.obtenerMascota(6059), error => {
      assert.ok(error instanceof PetManagementApiError);
      assert.equal(error.status, 200);
      assert.equal(error.code, null);
      return true;
    });
  }
});

test("detalle: 404 legacy sin code se conserva y se clasifica solo como detail-not-found", async t => {
  mockFetch(t, async () => response({ error: "Mascota no encontrada" }, 404));
  await assert.rejects(petManagementService.obtenerMascota(6059), error => {
    assert.ok(error instanceof PetManagementApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, null);
    assert.equal(petManagementErrorKind(error, "detail"), "detail-not-found");
    assert.equal(petManagementErrorKind(error, "search"), "read-error");
    return true;
  });
});

test("401 conserva la invalidación/redirección admin existente", async t => {
  storage.set("token", "ADMIN_JWT_TEST_SENTINEL");
  window.location.href = "";
  mockFetch(t, async () => response({}, 401));
  await assert.rejects(petManagementService.buscarMascotas({ q: "fi", estado: "todas" }), error => {
    assert.ok(error instanceof PetManagementApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, null);
    return true;
  });
  assert.equal(storage.get("token"), undefined);
  assert.equal(window.location.href, "/login");
});

test("query keys: namespace propio, localId y cambio de término/estado/limit", () => {
  assert.deepEqual(queryKeys.petManagement.scope("local-1"), ["pet-management", "local-1"]);
  const key = queryKeys.petManagement.search("local-1", "  firu  ", "todas", 20);
  assert.deepEqual(key, ["pet-management", "local-1", "search", "firu", "todas", 20]);
  assert.notDeepEqual(key, queryKeys.petManagement.search("local-2", "firu", "todas", 20));
  assert.notDeepEqual(key, queryKeys.petManagement.search("local-1", "firu", "inactivas", 20));
  assert.notDeepEqual(key, queryKeys.petManagement.search("local-1", "firu", "todas", 5));
  assert.deepEqual(queryKeys.petManagement.detail("local-1", 6059), ["pet-management", "local-1", "detail", 6059]);
  assert.notEqual(key[0], queryKeys.petAdminBooking.all[0]);
});

test("query options: search exige 2–100 y no reintenta ni refetchea foco/reconexión", () => {
  const query = petManagementSearchQuery("local-1", "  firu  ", "todas");
  assert.equal(query.queryKey[3], "firu");
  assert.equal(query.enabled, true);
  assert.equal(query.retry, false);
  assert.equal(query.refetchOnWindowFocus, false);
  assert.equal(query.refetchOnReconnect, false);
  assert.equal(query.staleTime, 0);
  assert.equal(query.gcTime, 0);

  for (const term of ["", "  ", " f ", "a".repeat(101)]) {
    assert.equal(petManagementSearchQuery("local-1", term, "todas").enabled, false);
  }
  assert.equal(petManagementSearchQuery(" ", "firu", "todas").enabled, false);
  assert.equal(petManagementSearchQuery("local-1", "firu", "todas", 0).enabled, false);
  assert.equal(petManagementSearchQuery("local-1", "firu", "todas", 21).enabled, false);
  assert.equal(petManagementSearchQuery("local-1", "firu", "otro" as never).enabled, false);
});

test("query options: detail es autoridad, exige local/ID y refetchea foco/reconexión", () => {
  const query = petManagementDetailQuery("local-1", 6059);
  assert.equal(query.enabled, true);
  assert.equal(query.retry, false);
  assert.equal(query.refetchOnWindowFocus, true);
  assert.equal(query.refetchOnReconnect, true);
  assert.equal(petManagementDetailQuery(" ", 6059).enabled, false);
  assert.equal(petManagementDetailQuery("local-1", null).enabled, false);
  assert.equal(petManagementDetailQuery("local-1", 0).enabled, false);
});

test("estado inicial: Todas, sin selección y sin búsqueda", () => {
  assert.deepEqual(petManagementInitialState(), {
    rawTerm: "",
    estado: "todas",
    selectedMascotaId: null,
    detailNotFound: false,
  });
  assert.equal(PET_MANAGEMENT_SEARCH_LIMIT, 20);
  assert.equal(PET_MANAGEMENT_SEARCH_DEBOUNCE_MS, 300);
});

test("reducer: término/filtro conservan ficha; limpiar no cierra; 404 solo afecta al ID vigente", () => {
  let state = petManagementInitialState();
  state = petManagementReducer(state, { type: "SET_RAW_TERM", rawTerm: "firu" });
  state = petManagementReducer(state, { type: "SELECT_MASCOTA", mascotaId: 6059 });
  assert.equal(state.selectedMascotaId, 6059);

  state = petManagementReducer(state, { type: "SET_RAW_TERM", rawTerm: "" });
  assert.equal(state.selectedMascotaId, 6059);
  state = petManagementReducer(state, { type: "SET_ESTADO", estado: "inactivas" });
  assert.equal(state.selectedMascotaId, 6059);
  assert.equal(state.estado, "inactivas");

  const stale = petManagementReducer(state, { type: "DETAIL_NOT_FOUND", mascotaId: 6060 });
  assert.equal(stale, state);
  assert.equal(stale.selectedMascotaId, 6059);

  const cleared = petManagementReducer(state, { type: "DETAIL_NOT_FOUND", mascotaId: 6059 });
  assert.equal(cleared.selectedMascotaId, null);
  assert.equal(cleared.detailNotFound, true);
  assert.equal(cleared.rawTerm, "");
  assert.equal(cleared.estado, "inactivas");

  const selected = petManagementReducer(cleared, { type: "SELECT_MASCOTA", mascotaId: 6060 });
  assert.equal(selected.selectedMascotaId, 6060);
  assert.equal(selected.detailNotFound, false);
  assert.equal(petManagementReducer(selected, { type: "SELECT_MASCOTA", mascotaId: 0 }), selected);
});

test("helpers de término: 0/1/101 no consultan; 2–100 sí", () => {
  assert.equal(petManagementNormalizedTerm("  firu  "), "firu");
  assert.equal(petManagementSearchRequestTerm(""), null);
  assert.equal(petManagementSearchRequestTerm("   "), null);
  assert.equal(petManagementSearchRequestTerm(" f "), null);
  assert.equal(petManagementSearchRequestTerm(" fi "), "fi");
  assert.equal(petManagementSearchRequestTerm("a".repeat(100)), "a".repeat(100));
  assert.equal(petManagementSearchRequestTerm("a".repeat(101)), null);
  assert.equal(petManagementSearchInputState(""), "empty");
  assert.equal(petManagementSearchInputState("   "), "empty");
  assert.equal(petManagementSearchInputState(" f "), "too-short");
  assert.equal(petManagementSearchInputState(" fi "), "ready");
  assert.equal(petManagementSearchInputState("a".repeat(101)), "too-long");
});

test("view: metadata de resultados, fecha, flags, textos y copy de límite", () => {
  assert.equal(petManagementResultMeta({ raza: "Mestizo", responsables: [] }),
    "Sin responsable asociado · Mestizo");
  assert.equal(petManagementResultMeta({ raza: null, responsables: [] }), "Sin responsable asociado");
  assert.equal(petManagementResultMeta({ raza: "Mestizo", responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
  ] }), "Juan Pérez · Mestizo");
  assert.equal(petManagementResultMeta({ raza: null, responsables: [
    { id: 1, nombre: "Juan Pérez", telefono: "11 2345-6789" },
    { id: 2, nombre: "María Gómez", telefono: "11 8765-4321" },
    { id: 3, nombre: "Ana Díaz", telefono: "11 1111-2222" },
  ] }), "Juan Pérez · María Gómez (+1)");

  assert.equal(petManagementText("  Mestizo  "), "Mestizo");
  assert.equal(petManagementText("   "), "Sin datos");
  assert.equal(petManagementText(null), "Sin datos");
  assert.match(petManagementDateLabel("2021-03-04"), /2021/);
  assert.match(petManagementDateLabel("2021-03-04"), /marzo/i);
  assert.equal(petManagementDateLabel(null), "Sin datos");
  assert.equal(petManagementDateLabel("sin-fecha"), "sin-fecha");
  assert.equal(petManagementFlagLabel(true, "Sí", "No"), "Sí");
  assert.equal(petManagementFlagLabel(false, "Sí", "No"), "No");
  assert.equal(petManagementShowsLimitCopy(19), false);
  assert.equal(petManagementShowsLimitCopy(20), true);
  assert.equal(petManagementShowsLimitCopy(21), false);
  assert.match(PET_MANAGEMENT_LIMIT_MESSAGE, /hasta 20 resultados/);
  assert.equal(PET_MANAGEMENT_UNAVAILABLE_MESSAGE, "La mascota ya no está disponible.");
});

test("errores: clasificación por status/code estable y copy controlado", () => {
  assert.equal(petManagementErrorKind(new PetManagementApiError(401, null), "search"), "unauthorized");
  assert.equal(petManagementErrorKind(new PetManagementApiError(403, null), "detail"), "forbidden");
  assert.equal(petManagementErrorKind(new PetManagementApiError(400, "PET_MASCOTA_SEARCH_INVALID"), "search"), "search-invalid");
  assert.equal(petManagementErrorKind(new PetManagementApiError(400, null), "search"), "read-error");
  assert.equal(petManagementErrorKind(new PetManagementApiError(404, null), "detail"), "detail-not-found");
  assert.equal(petManagementErrorKind(new PetManagementApiError(404, null), "search"), "read-error");
  assert.equal(petManagementErrorKind(new PetManagementApiError(200, null), "detail"), "protocol");
  assert.equal(petManagementErrorKind(new PetManagementApiError(500, null), "search"), "read-error");
  assert.equal(petManagementErrorKind(new Error("texto remoto"), "search"), "read-error");

  assert.equal(petManagementSearchErrorMessage(null), null);
  assert.match(petManagementSearchErrorMessage("search-invalid") ?? "", /Revisá el término/);
  assert.match(petManagementSearchErrorMessage("forbidden") ?? "", /permisos/);
  assert.match(petManagementDetailErrorMessage("detail-not-found") ?? "", /ya no está disponible/);
  assert.match(petManagementDetailErrorMessage("read-error") ?? "", /No pudimos cargar/);
});

test("search A/B: cambiar key aborta A y B conserva su propio resultado", async t => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let firstSignal: AbortSignal | null = null;
  mockFetch(t, (url, init) => {
    if (url.includes("q=aa")) {
      firstSignal = init?.signal ?? null;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    }
    return Promise.resolve(response([searchDto({ id: 6060, nombre: "B" })]));
  });

  const observer = new QueryObserver(client, petManagementSearchQuery("local-1", "aa", "todas", 20));
  const unsubscribe = observer.subscribe(() => {});
  await waitFor(() => firstSignal !== null);

  observer.setOptions(petManagementSearchQuery("local-1", "bb", "todas", 20));
  await client.fetchQuery(petManagementSearchQuery("local-1", "bb", "todas", 20));
  await waitFor(() => observer.getCurrentResult().isSuccess);

  assert.equal(firstSignal?.aborted, true);
  assert.deepEqual(observer.getCurrentResult().data?.map(item => item.id), [6060]);
  unsubscribe();
  client.clear();
});

test("shell: Mascotas, Servicios y Extras PET tienen contenido propio; solo Mascotas usa ancho amplio", () => {
  assert.equal(getPetAdminContentKind("mascotas"), "mascotas");
  assert.equal(getPetAdminContentKind("solicitudes"), "placeholder");
  assert.equal(getPetAdminContentKind("servicios"), "servicios");
  assert.equal(getPetAdminContentKind("extras"), "extras");
  assert.equal(getPetAdminContentKind("horarios"), "horarios");
  assert.equal(getPetAdminContentKind("bloqueos"), "bloqueos");
  assert.equal(getPetAdminContentKind("configuracion"), "placeholder");
  assert.equal(getPetAdminContentKind("agenda"), "agenda");
  assert.equal(getPetAdminContentKind("reservar"), "reservar");
  assert.equal(getPetAdminContentKind("whatsapp"), "whatsapp");
  assert.equal(getPetAdminContentKind("dashboard"), "none");
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.PET_GROOMING, "mascotas"), true);
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.BEAUTY, "mascotas"), false);
  assert.equal(isWidePetAdminContent(BUSINESS_TYPE.PET_GROOMING, "agenda"), false);
});
