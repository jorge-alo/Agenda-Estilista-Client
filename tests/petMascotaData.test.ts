import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import type { PetManagementDetail } from "../src/feature/admin/petManagement/types/petManagement.types.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); }
      catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
});
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) },
});
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const {
  emptyMascotaDraft, normalizeMascotaDraft, detailToMascotaDraft, validateMascotaDraft,
  buildMascotaDataPatch, mascotaDraftDirty, mascotaBirthDateValid, MASCOTA_TEXT_LIMITS,
} = await import("../src/feature/admin/petManagement/forms/petMascotaForm.ts");
const { petManagementService } = await import("../src/feature/admin/petManagement/services/petManagement.service.ts");
const { createPetMascotaFormController, MASCOTA_CREATE_UNKNOWN, MASCOTA_UPDATE_UNKNOWN } = await import(
  "../src/feature/admin/petManagement/state/petMascotaFormController.ts"
);
const { createMascotaMutation, updateMascotaDataMutation } = await import("../src/feature/admin/petManagement/mutations/petMascotaMutations.ts");
const { petManagementDetailQuery } = await import("../src/feature/admin/petManagement/queries/petManagementQueries.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const { petManagementInitialState, petManagementReducer } = await import("../src/feature/admin/petManagement/state/petManagementState.ts");

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "ADMIN_TEST_SENTINEL");
  window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}
function detail(overrides: Partial<PetManagementDetail> = {}): PetManagementDetail {
  return {
    id: 10, nombre: "Firu", raza: "Mestizo", fechaNacimiento: "2020-02-29", sexo: "Valor histórico",
    tamano: "Otro tamaño", tipoPelo: "Otro pelo", observaciones: "Algo", activo: true,
    altaExigencia: false, reservaOnlineHabilitada: false,
    responsables: [{ id: 55, nombre: "Ana", telefono: "11" }], ...overrides,
  };
}
function dto(value = detail()) {
  return {
    id: value.id, nombre: value.nombre, raza: value.raza, fecha_nacimiento: value.fechaNacimiento,
    sexo: value.sexo, tamano: value.tamano, tipo_pelo: value.tipoPelo, observaciones: value.observaciones,
    activo: value.activo ? 1 : 0, alta_exigencia: value.altaExigencia ? 1 : 0,
    reserva_online_habilitada: value.reservaOnlineHabilitada ? 1 : 0, responsables: value.responsables,
  };
}
function makeClient(t: TestContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear());
  return client;
}
function setup(t: TestContext) {
  const client = makeClient(t);
  const selected: number[] = [];
  const unavailable: number[] = [];
  let discard = false;
  let confirms = 0;
  const controller = createPetMascotaFormController(client, {
    localId: "local-test", onSelect: id => { selected.push(id); }, onUnavailable: id => { unavailable.push(id); },
    confirmDiscard: () => { confirms++; return discard; },
  });
  controller.syncSelection(10, detail());
  t.after(() => controller.disconnect());
  return { client, controller, selected, unavailable, allowDiscard: () => { discard = true; }, confirms: () => confirms };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}
async function waitFor(fn: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("waitFor timeout");
    await nextTick();
  }
}

test("Datos helpers: trim, vacíos a null, fecha string y proyección exclusiva de los siete campos", () => {
  assert.deepEqual(normalizeMascotaDraft({
    ...emptyMascotaDraft(), nombre: "  Firu  ", raza: "  ", fecha_nacimiento: "2020-02-29",
    sexo: " texto libre ", tamano: " ", tipo_pelo: " Largo ", observaciones: " Algo \n",
  }), {
    nombre: "Firu", raza: null, fecha_nacimiento: "2020-02-29", sexo: "texto libre", tamano: null,
    tipo_pelo: "Largo", observaciones: "Algo",
  });
  assert.deepEqual(Object.keys(detailToMascotaDraft(detail())), ["nombre", "raza", "fecha_nacimiento", "sexo", "tamano", "tipo_pelo", "observaciones"]);
});

test("Datos helpers: calendario sin timezone ni restricciones de edad/futuro", () => {
  for (const value of ["2000-02-29", "2024-02-29", "2099-12-31"]) assert.equal(mascotaBirthDateValid(value), true);
  for (const value of ["1900-02-29", "2023-02-29", "2024-04-31", "2024-00-01", "2024-01-00", "0000-01-01", "2020-1-01", "2020-01-01T00:00:00Z"]) {
    assert.equal(mascotaBirthDateValid(value), false, value);
  }
});

test("Datos helpers: validación usa máximos reales, nombre requerido y textos libres", () => {
  assert.ok(validateMascotaDraft(emptyMascotaDraft()).nombre);
  for (const [field, limit] of Object.entries(MASCOTA_TEXT_LIMITS)) {
    const valid = { ...emptyMascotaDraft(), nombre: "Firu", [field]: "x".repeat(limit) };
    assert.deepEqual(validateMascotaDraft(valid), {});
    assert.ok(validateMascotaDraft({ ...valid, [field]: "x".repeat(limit + 1) })[field as keyof typeof MASCOTA_TEXT_LIMITS]);
  }
  assert.deepEqual(validateMascotaDraft({ ...detailToMascotaDraft(detail()), observaciones: "x".repeat(10000) }), {});
  assert.deepEqual(validateMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu", fecha_nacimiento: "2099-12-31" }), {});
  assert.ok(validateMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu", fecha_nacimiento: "2023-02-29" }).fecha_nacimiento);
});

test("Datos helpers: PATCH parcial, null para limpiar, no-op y dirty normalizado", () => {
  const draft = detailToMascotaDraft(detail());
  const original = normalizeMascotaDraft(draft);
  assert.deepEqual(buildMascotaDataPatch(original, { ...draft, raza: " Caniche ", observaciones: "  " }), { raza: "Caniche", observaciones: null });
  assert.deepEqual(buildMascotaDataPatch(original, { ...draft, nombre: " Firu " }), {});
  assert.equal(mascotaDraftDirty(original, { ...draft, nombre: " Firu " }), false);
  assert.equal(mascotaDraftDirty(original, { ...draft, raza: "Caniche" }), true);
});

test("create service: POST exacto, JWT, siete campos; sin tenant, flags, responsables ni metadata", async t => {
  let count = 0;
  mockFetch(t, async (url, init) => {
    count++;
    assert.equal(url, "/api/pet/admin/mascotas");
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer ADMIN_TEST_SENTINEL");
    assert.equal((init.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(init.body)), normalizeMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu" }));
    assert.equal(init.signal, undefined);
    return json({ id: 101, nombre: "POST projection", local_id: 999, activo: 1 }, 201);
  });
  const input = { ...normalizeMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu" }), id: 9, local_id: 999,
    activo: false, altaExigencia: true, reservaOnlineHabilitada: true, responsables: [1], created_at: "ignored" };
  assert.deepEqual(await petManagementService.createMascota(input), { id: 101 });
  assert.equal(count, 1);
});

test("update service: PATCH exacto, solo diff allowlisted, sin flags snake/camel ni tenant", async t => {
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/mascotas/10");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init.body)), { raza: "Caniche", observaciones: null });
    return json({ id: 10 });
  });
  const patch = { raza: "Caniche", observaciones: null, local_id: 999, activo: false, alta_exigencia: 1,
    reserva_online_habilitada: 1, altaExigencia: true, reservaOnlineHabilitada: true, responsables: [] };
  assert.deepEqual(await petManagementService.updateMascotaData(10, patch), { id: 10 });
});

test("update service: PATCH vacío o ID inválido no ejecutan request", async t => {
  mockFetch(t, async () => { throw new Error("unexpected request"); });
  await assert.rejects(petManagementService.updateMascotaData(10, {}), { status: 400 });
  await assert.rejects(petManagementService.updateMascotaData(-1, { nombre: "Firu" }), { status: 400 });
});

test("write parsers: 201 inválido, status inesperado y PATCH de otro ID no confirman éxito", async t => {
  let result = json({ id: 0 }, 201);
  mockFetch(t, async () => result);
  const data = normalizeMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu" });
  await assert.rejects(petManagementService.createMascota(data), { status: 201 });
  result = json({ id: 1 }, 200);
  await assert.rejects(petManagementService.createMascota(data), { status: 200 });
  result = new Response("invalid json", { status: 201 });
  await assert.rejects(petManagementService.createMascota(data), { status: 201 });
  result = json({ id: 20 });
  await assert.rejects(petManagementService.updateMascotaData(10, { raza: null }), { status: 200 });
});

test("mutations: retry false, namespace propio y sin efectos BEAUTY", t => {
  const client = makeClient(t);
  assert.equal(createMascotaMutation(client, "L").retry, false);
  assert.equal(updateMascotaDataMutation(client, "L").retry, false);
  assert.deepEqual(createMascotaMutation(client, "L").mutationKey, ["pet-management", "L", "create"]);
});

test("create invalidation: searches PET y listado; otros locales/BEAUTY/detail ajeno intactos", async t => {
  const client = makeClient(t);
  const affected = [queryKeys.petManagement.detail("L", 101), queryKeys.petManagement.search("L", "fi", "todas", 20), queryKeys.petAdminBooking.searchMascotas("fi", 20), queryKeys.petAdminBooking.mascotas()];
  const untouched = [queryKeys.petManagement.search("OTHER", "fi", "todas", 20), queryKeys.petAdminBooking.mascotaDetail(20), queryKeys.clientes.all, queryKeys.petTurnos.fecha("2026-10-20")];
  for (const key of [...affected, ...untouched]) client.setQueryData(key, []);
  mockFetch(t, async () => json({ id: 101 }, 201));
  await new MutationObserver(client, createMascotaMutation(client, "L")).mutate(normalizeMascotaDraft({ ...emptyMascotaDraft(), nombre: "Firu" }));
  for (const key of affected) assert.equal(client.getQueryState(key)?.isInvalidated, true);
  for (const key of untouched) assert.equal(client.getQueryState(key)?.isInvalidated, false);
});

test("update invalidation: detail exacto, searches y agenda solo si cambia nombre; sin alterar snapshots", async t => {
  const client = makeClient(t);
  const affected = [queryKeys.petManagement.detail("L", 10), queryKeys.petManagement.search("L", "fi", "todas", 20), queryKeys.petAdminBooking.mascotaDetail(10), queryKeys.petAdminBooking.searchMascotas("fi", 20)];
  const untouched = [queryKeys.petManagement.detail("L", 20), queryKeys.petManagement.detail("OTHER", 10), queryKeys.petAdminBooking.mascotaDetail(20), queryKeys.turnos.all];
  const agenda = queryKeys.petTurnos.fecha("2026-10-20");
  for (const key of [...affected, ...untouched, agenda]) client.setQueryData(key, { snapshot: "original" });
  mockFetch(t, async () => json({ id: 10 }));
  const mutation = new MutationObserver(client, updateMascotaDataMutation(client, "L"));
  await mutation.mutate({ id: 10, patch: { raza: "Caniche" } });
  for (const key of affected) assert.equal(client.getQueryState(key)?.isInvalidated, true);
  for (const key of [...untouched, agenda]) assert.equal(client.getQueryState(key)?.isInvalidated, false);
  await mutation.mutate({ id: 10, patch: { nombre: "Nuevo nombre" } });
  assert.equal(client.getQueryState(agenda)?.isInvalidated, true);
  assert.deepEqual(client.getQueryData(agenda), { snapshot: "original" });
});

test("controller: create/cancel/edit/cancel son locales y protegen datos escritos", t => {
  const { controller, confirms, allowDiscard } = setup(t);
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.equal(controller.beginCreate(), true);
  assert.equal(controller.cancel(), true);
  controller.beginCreate();
  controller.change("nombre", "Nueva");
  assert.equal(controller.cancel(), false);
  assert.equal(controller.beginCreate(), false);
  assert.equal(confirms(), 2);
  allowDiscard();
  assert.equal(controller.cancel(), true);
  assert.equal(controller.beginEdit(detail()), true);
  controller.change("raza", "Caniche");
  assert.equal(controller.cancel(), true);
  assert.equal(controller.getSnapshot().mode, "viewing");
});

test("controller: dirty bloquea otra mascota y Nueva hasta confirmación; search no altera draft", t => {
  const { controller, selected, allowDiscard } = setup(t);
  controller.beginEdit(detail());
  controller.change("raza", "Caniche");
  assert.equal(controller.selectMascota(20), false);
  assert.equal(controller.beginCreate(), false);
  controller.syncSelection(10, detail());
  assert.equal(controller.getSnapshot().draft.raza, "Caniche");
  assert.deepEqual(selected, []);
  allowDiscard();
  assert.equal(controller.selectMascota(20), true);
  assert.deepEqual(selected, [20]);
  assert.equal(controller.getSnapshot().mode, "viewing");
});

test("controller: no-op normalizado no ejecuta PATCH, submit inválido conserva campos/errores", async t => {
  const { controller } = setup(t);
  let calls = 0;
  mockFetch(t, async () => { calls++; return json({}); });
  controller.beginEdit(detail());
  controller.change("nombre", " Firu ");
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(await controller.submit(), false);
  controller.change("nombre", "  ");
  assert.equal(await controller.submit(), false);
  assert.ok(controller.getSnapshot().errors.nombre);
  assert.equal(controller.getSnapshot().draft.nombre, "  ");
  assert.equal(calls, 0);
});

test("controller: refetch sincroniza pristine; dirty conserva original/draft y detecta versión remota", t => {
  const { controller, allowDiscard } = setup(t);
  controller.beginEdit(detail());
  controller.syncSelection(10, detail({ raza: "Remota" }));
  assert.equal(controller.getSnapshot().draft.raza, "Remota");
  assert.equal(controller.getSnapshot().dirty, false);
  controller.change("raza", "Mía");
  controller.syncSelection(10, detail({ raza: "Última" }));
  assert.equal(controller.getSnapshot().draft.raza, "Mía");
  assert.equal(controller.getSnapshot().original.raza, "Remota");
  assert.equal(controller.getSnapshot().serverChanged, true);
  allowDiscard();
  controller.cancel();
  controller.beginEdit(detail({ raza: "Última" }));
  assert.equal(controller.getSnapshot().draft.raza, "Última");
});

test("controller: al volver a pristine adopta snapshot remoto completo sin merge", t => {
  const { controller } = setup(t);
  controller.beginEdit(detail());
  controller.change("raza", "Mía");
  controller.syncSelection(10, detail({ raza: "Remota", nombre: "Nombre remoto" }));
  controller.change("raza", "Mestizo");
  assert.equal(controller.getSnapshot().draft.raza, "Remota");
  assert.equal(controller.getSnapshot().draft.nombre, "Nombre remoto");
  assert.equal(controller.getSnapshot().dirty, false);
});

test("create flow: doble submit un POST; conserva search/filtro y abre GET autoritativo con responsables", async t => {
  const client = makeClient(t);
  const gate = deferred<Response>();
  let posts = 0;
  let gets = 0;
  let state = petManagementReducer(petManagementInitialState(), { type: "SET_RAW_TERM", rawTerm: "otra búsqueda" });
  state = petManagementReducer(state, { type: "SET_ESTADO", estado: "inactivas" });
  const observer = new QueryObserver(client, petManagementDetailQuery("L", null));
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  const controller = createPetMascotaFormController(client, { localId: "L", confirmDiscard: () => false,
    onSelect: id => {
      state = petManagementReducer(state, { type: "SELECT_MASCOTA", mascotaId: id });
      observer.setOptions(petManagementDetailQuery("L", id));
    }, onUnavailable: () => {} });
  t.after(() => controller.disconnect());
  mockFetch(t, async (url, init) => {
    if (init.method === "POST") { posts++; return gate.promise; }
    assert.equal(url, "/api/pet/admin/mascotas/101"); gets++;
    return json(dto(detail({ id: 101, nombre: "Nombre desde GET" })));
  });
  controller.beginCreate(); controller.change("nombre", "Nueva");
  const first = controller.submit();
  assert.equal(controller.getSnapshot().mode, "submittingCreate");
  assert.equal(await controller.submit(), false);
  assert.equal(controller.cancel(), false);
  assert.equal(controller.selectMascota(20), false);
  await waitFor(() => posts === 1);
  gate.resolve(json({ id: 101, nombre: "No es ficha completa" }, 201));
  assert.equal(await first, true);
  await waitFor(() => observer.getCurrentResult().isSuccess);
  assert.equal(state.rawTerm, "otra búsqueda"); assert.equal(state.estado, "inactivas");
  assert.equal(state.selectedMascotaId, 101);
  assert.equal(observer.getCurrentResult().data?.nombre, "Nombre desde GET");
  assert.equal(observer.getCurrentResult().data?.responsables.length, 1);
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.equal(posts, 1); assert.equal(gets, 1);
});

test("edit flow: doble submit un PATCH parcial; confirmación cierra edición", async t => {
  const { controller } = setup(t);
  const gate = deferred<Response>();
  let patches = 0;
  mockFetch(t, async (_url, init) => {
    patches++;
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init.body)), { raza: "Caniche", observaciones: null });
    return gate.promise;
  });
  controller.beginEdit(detail()); controller.change("raza", "Caniche"); controller.change("observaciones", "");
  const first = controller.submit();
  assert.equal(controller.getSnapshot().mode, "submittingEdit");
  assert.equal(await controller.submit(), false);
  controller.change("raza", "No debe entrar durante submit");
  await waitFor(() => patches === 1);
  gate.resolve(json({ id: 10 }));
  assert.equal(await first, true);
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.equal(patches, 1);
});

for (const operation of ["create", "edit"] as const) {
  test(`${operation}: 400 conserva draft, no refetch ni replay`, async t => {
    const { controller } = setup(t);
    let calls = 0;
    mockFetch(t, async () => { calls++; return json({ error: "REMOTE_UNTRUSTED" }, 400); });
    if (operation === "create") controller.beginCreate(); else controller.beginEdit(detail());
    controller.change("nombre", "Nuevo");
    await controller.submit();
    assert.equal(controller.getSnapshot().draft.nombre, "Nuevo");
    assert.equal(controller.getSnapshot().mode, operation === "create" ? "creating" : "editing");
    assert.match(controller.getSnapshot().errorMessage ?? "", /Revisá los campos/);
    assert.doesNotMatch(controller.getSnapshot().errorMessage ?? "", /REMOTE_UNTRUSTED/);
    assert.equal(calls, 1);
  });
}

for (const failure of ["network", "500"] as const) {
  test(`create ${failure}: resultado incierto conserva draft, sin retry ni GET inventado`, async t => {
    const { controller, selected } = setup(t);
    let calls = 0;
    mockFetch(t, async () => { calls++; if (failure === "network") throw new Error("sensitive"); return json({}, 500); });
    controller.beginCreate(); controller.change("nombre", "Nueva");
    await controller.submit();
    assert.equal(controller.getSnapshot().mode, "creating");
    assert.equal(controller.getSnapshot().draft.nombre, "Nueva");
    assert.equal(controller.getSnapshot().errorMessage, MASCOTA_CREATE_UNKNOWN);
    assert.deepEqual(selected, []); assert.equal(calls, 1);
  });

  test(`edit ${failure}: verifica GET, conserva draft y no asume si PATCH persistió`, async t => {
    const { controller } = setup(t);
    let writes = 0; let reads = 0;
    mockFetch(t, async (_url, init) => {
      if (init.method === "PATCH") { writes++; if (failure === "network") throw new Error("sensitive"); return json({}, 500); }
      reads++; return json(dto(detail({ raza: "Caniche" })));
    });
    controller.beginEdit(detail()); controller.change("raza", "Caniche");
    await controller.submit();
    assert.equal(controller.getSnapshot().mode, "editing");
    assert.equal(controller.getSnapshot().draft.raza, "Caniche");
    assert.equal(controller.getSnapshot().original.raza, "Mestizo");
    assert.equal(controller.getSnapshot().serverChanged, true);
    assert.equal(controller.getSnapshot().needsRefresh, false);
    assert.match(controller.getSnapshot().errorMessage ?? "", /No se pudo confirmar el cambio/);
    assert.equal(writes, 1); assert.equal(reads, 1);
  });
}

test("edit incierto: GET fallido bloquea submit; verificación manual recupera sin destruir draft", async t => {
  const { controller } = setup(t);
  let writes = 0; let reads = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") { writes++; return json({}, 500); }
    reads++; return reads === 1 ? json({}, 500) : json(dto());
  });
  controller.beginEdit(detail()); controller.change("raza", "Caniche");
  await controller.submit();
  assert.equal(controller.getSnapshot().needsRefresh, true);
  assert.ok(controller.getSnapshot().errorMessage?.startsWith(MASCOTA_UPDATE_UNKNOWN));
  assert.equal(await controller.submit(), false);
  await controller.verifyDetail();
  assert.equal(controller.getSnapshot().draft.raza, "Caniche");
  assert.equal(controller.getSnapshot().needsRefresh, false);
  assert.equal(writes, 1); assert.equal(reads, 2);
});

for (const getStatus of [200, 404, 500]) {
  test(`PATCH 404 contextual: GET ${getStatus} es quien confirma ausencia o conserva edición`, async t => {
    const { controller, unavailable } = setup(t);
    let reads = 0;
    mockFetch(t, async (url, init) => {
      assert.equal(url, "/api/pet/admin/mascotas/10");
      if (init.method === "PATCH") return json({ error: "No inferir por texto" }, 404);
      reads++; return getStatus === 200 ? json(dto()) : json({}, getStatus);
    });
    controller.beginEdit(detail()); controller.change("raza", "Caniche");
    await controller.submit();
    assert.equal(reads, 1);
    assert.deepEqual(unavailable, getStatus === 404 ? [10] : []);
    assert.equal(controller.getSnapshot().mode, getStatus === 404 ? "viewing" : "editing");
    if (getStatus !== 404) assert.equal(controller.getSnapshot().draft.raza, "Caniche");
  });
}

for (const status of [401, 403]) {
  test(`write ${status}: auth estándar, conserva draft y no entra en recovery`, async t => {
    const { controller } = setup(t);
    let calls = 0;
    mockFetch(t, async () => { calls++; return json({ error: "private" }, status); });
    controller.beginEdit(detail()); controller.change("raza", "Caniche");
    await controller.submit();
    assert.equal(controller.getSnapshot().draft.raza, "Caniche");
    assert.equal(calls, 1);
    assert.match(controller.getSnapshot().errorMessage ?? "", status === 401 ? /sesión/ : /permisos/);
    if (status === 401) { assert.equal(storage.has("token"), false); assert.equal(window.location.href, "/login"); }
  });
}

for (const operation of ["create", "edit"] as const) {
  test(`${operation}: éxito tardío de A no altera B ni selecciona A`, async t => {
    const { controller, selected } = setup(t);
    const gate = deferred<Response>();
    let writes = 0;
    mockFetch(t, async () => { writes++; return gate.promise; });
    if (operation === "create") controller.beginCreate(); else controller.beginEdit(detail());
    controller.change("nombre", "Operación A");
    const submit = controller.submit();
    await waitFor(() => writes === 1);
    controller.syncSelection(20, detail({ id: 20, nombre: "B" }));
    gate.resolve(json({ id: operation === "create" ? 101 : 10 }, operation === "create" ? 201 : 200));
    assert.equal(await submit, false);
    assert.deepEqual(selected, []);
    assert.equal(controller.getSnapshot().mode, "viewing");
    assert.equal(controller.getSnapshot().notice, null);
  });
}

test("recovery tardío 404 de A no cierra B", async t => {
  const { controller, unavailable } = setup(t);
  const gate = deferred<Response>();
  let reads = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") return json({}, 404);
    reads++; return gate.promise;
  });
  controller.beginEdit(detail()); controller.change("raza", "Caniche");
  const submitting = controller.submit();
  await waitFor(() => reads === 1);
  controller.syncSelection(20, detail({ id: 20 }));
  gate.resolve(json({}, 404));
  await submitting;
  assert.deepEqual(unavailable, []);
  assert.equal(controller.getSnapshot().mode, "viewing");
});

test("controller: cleanup/reconnect StrictMode no duplica POST; unmount ignora resultado tardío", async t => {
  const { controller, selected } = setup(t);
  controller.disconnect(); controller.connect();
  let calls = 0;
  const gate = deferred<Response>();
  mockFetch(t, async () => { calls++; return gate.promise; });
  controller.beginCreate(); controller.change("nombre", "Nueva");
  const submitting = controller.submit();
  await waitFor(() => calls === 1);
  controller.disconnect();
  gate.resolve(json({ id: 101 }, 201));
  await submitting;
  assert.deepEqual(selected, []);
  assert.equal(calls, 1);
});

test("POST confirmado + GET fallido: mantiene nueva selección y no transforma el fallo de lectura en replay", async t => {
  const client = makeClient(t);
  const observer = new QueryObserver(client, petManagementDetailQuery("L", null));
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  let selected: number | null = null;
  const controller = createPetMascotaFormController(client, {
    localId: "L", confirmDiscard: () => false, onUnavailable: () => {},
    onSelect: id => { selected = id; observer.setOptions(petManagementDetailQuery("L", id)); },
  });
  t.after(() => controller.disconnect());
  let posts = 0; let reads = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "POST") { posts++; return json({ id: 101 }, 201); }
    reads++; return json({}, 500);
  });
  controller.beginCreate(); controller.change("nombre", "Nueva");
  assert.equal(await controller.submit(), true);
  await waitFor(() => observer.getCurrentResult().isError);
  assert.equal(selected, 101);
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.equal(posts, 1); assert.equal(reads, 1);
});

test("PATCH confirmado refetchea GET completo; no usa su respuesta como ficha ni pierde responsables", async t => {
  const { controller, client } = setup(t);
  const observer = new QueryObserver(client, petManagementDetailQuery("local-test", 10));
  let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") return json({ id: 10, nombre: "Respuesta PATCH incompleta" });
    gets++;
    return json(dto(detail({ raza: gets === 1 ? "Mestizo" : "Caniche" })));
  });
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  await waitFor(() => observer.getCurrentResult().isSuccess);
  controller.beginEdit(detail()); controller.change("raza", "Caniche");
  assert.equal(await controller.submit(), true);
  assert.equal(gets, 2);
  assert.equal(observer.getCurrentResult().data?.raza, "Caniche");
  assert.equal(observer.getCurrentResult().data?.nombre, "Firu");
  assert.equal(observer.getCurrentResult().data?.responsables.length, 1);
});

test("POST con 201 malformado es incierto, conserva alta y no inventa selección", async t => {
  const { controller, selected } = setup(t);
  let calls = 0;
  mockFetch(t, async () => { calls++; return json({ nombre: "sin ID" }, 201); });
  controller.beginCreate(); controller.change("nombre", "Nueva");
  assert.equal(await controller.submit(), false);
  assert.equal(controller.getSnapshot().errorMessage, MASCOTA_CREATE_UNKNOWN);
  assert.equal(controller.getSnapshot().draft.nombre, "Nueva");
  assert.deepEqual(selected, []);
  assert.equal(calls, 1);
});

test("error tardío de A no inicia recovery ni pisa edición de B", async t => {
  const { controller, unavailable } = setup(t);
  const gate = deferred<Response>();
  let calls = 0;
  mockFetch(t, async () => { calls++; return gate.promise; });
  controller.beginEdit(detail()); controller.change("raza", "A");
  const submitting = controller.submit();
  await waitFor(() => calls === 1);
  const b = detail({ id: 20, nombre: "B" });
  controller.syncSelection(20, b); controller.beginEdit(b); controller.change("raza", "Draft B");
  gate.resolve(json({}, 500));
  await submitting;
  assert.equal(controller.getSnapshot().draft.raza, "Draft B");
  assert.equal(controller.getSnapshot().mascotaId, 20);
  assert.equal(controller.getSnapshot().errorMessage, null);
  assert.deepEqual(unavailable, []); assert.equal(calls, 1);
});

test("404 de la ficha anterior no descarta un alta dirty independiente", t => {
  const { controller } = setup(t);
  controller.beginCreate(); controller.change("nombre", "Nueva independiente");
  controller.syncSelection(null, null);
  assert.equal(controller.getSnapshot().mode, "creating");
  assert.equal(controller.getSnapshot().draft.nombre, "Nueva independiente");
  assert.equal(controller.getSnapshot().dirty, true);
});

test("404 de la ficha anterior durante POST no invalida el alta nueva confirmada", async t => {
  const { controller, selected } = setup(t);
  let calls = 0;
  const gate = deferred<Response>();
  mockFetch(t, async () => { calls++; return gate.promise; });
  controller.beginCreate(); controller.change("nombre", "Nueva independiente");
  const submitting = controller.submit();
  await waitFor(() => calls === 1);
  controller.syncSelection(null, null);
  assert.equal(controller.getSnapshot().mode, "submittingCreate");
  gate.resolve(json({ id: 101 }, 201));
  assert.equal(await submitting, true);
  assert.deepEqual(selected, [101]);
  assert.equal(calls, 1);
});
