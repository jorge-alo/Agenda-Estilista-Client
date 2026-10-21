import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import type { MascotaFlag, MascotaFlagChange } from "../src/feature/admin/petManagement/types/petMascotaFlags.types.ts";
import type { PetManagementDetail } from "../src/feature/admin/petManagement/types/petManagement.types.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
});
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) },
});
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });
const { petMascotaFlagsService } = await import("../src/feature/admin/petManagement/services/petMascotaFlags.service.ts");
const { createPetMascotaFlagsController } = await import("../src/feature/admin/petManagement/state/petMascotaFlagsController.ts");
const { updateMascotaFlagMutation } = await import("../src/feature/admin/petManagement/mutations/petMascotaFlagsMutations.ts");
const { createPetMascotaFormController } = await import("../src/feature/admin/petManagement/state/petMascotaFormController.ts");
const { createPetResponsablesController } = await import("../src/feature/admin/petManagement/state/petResponsablesController.ts");
const { petManagementDetailQuery, petManagementSearchQuery } = await import("../src/feature/admin/petManagement/queries/petManagementQueries.ts");
const { mascotaFlagLabels, mascotaFlagConfirmation, MASCOTA_HIGH_DEMAND_INFO, MASCOTA_REACTIVATION_BLOCKED, MASCOTA_FLAG_UNKNOWN } = await import("../src/feature/admin/petManagement/components/petMascotaFlagsView.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");

const original = { id: 55, nombre: "Responsable original", telefono: "11 2345 6789" };
function detail(overrides: Partial<PetManagementDetail> = {}): PetManagementDetail {
  return { id: 10, nombre: "Firu", raza: "Mestizo", fechaNacimiento: null, sexo: null, tamano: null,
    tipoPelo: null, observaciones: "Original", activo: true, altaExigencia: false, reservaOnlineHabilitada: false,
    responsables: [original], ...overrides };
}
function dto(value = detail()) {
  return { id: value.id, nombre: value.nombre, raza: value.raza, fecha_nacimiento: value.fechaNacimiento,
    sexo: value.sexo, tamano: value.tamano, tipo_pelo: value.tipoPelo, observaciones: value.observaciones,
    activo: value.activo ? 1 : 0, alta_exigencia: value.altaExigencia ? 1 : 0,
    reserva_online_habilitada: value.reservaOnlineHabilitada ? 1 : 0, responsables: value.responsables };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
function ack(change: MascotaFlagChange) {
  return json(change.flag === "reservaOnlineHabilitada" ? { id: 10, reservaOnlineHabilitada: change.value }
    : { ...dto(detail({ [change.flag]: change.value })), nombre: "PATCH no es la ficha" });
}
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "ADMIN_TEST_SENTINEL"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}
function makeClient(t: TestContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear()); return client;
}
function setup(t: TestContext, value = detail(), canChange?: () => boolean) {
  const client = makeClient(t); const unavailable: number[] = []; const confirmations: MascotaFlagChange[] = [];
  let allow = true;
  const controller = createPetMascotaFlagsController(client, { localId: "L", canChange,
    onUnavailable: id => unavailable.push(id), confirmChange: change => { confirmations.push(change); return allow; } });
  controller.syncSelection(value.id, value); t.after(() => controller.disconnect());
  return { client, controller, unavailable, confirmations, rejectConfirmation: () => { allow = false; } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve };
}
async function waitFor(fn: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!fn()) { if (Date.now() > deadline) throw new Error("waitFor timeout"); await nextTick(); }
}
const changes: MascotaFlagChange[] = [
  { flag: "activo", value: false }, { flag: "activo", value: true },
  { flag: "altaExigencia", value: true }, { flag: "altaExigencia", value: false },
  { flag: "reservaOnlineHabilitada", value: false },
  { flag: "reservaOnlineHabilitada", value: true },
];
const recoveryChanges = changes.filter(change => change.flag !== "activo" || !change.value).filter(change => change.flag !== "altaExigencia" || change.value);

for (const change of changes) {
  test(`flags service ${change.flag}=${change.value}: PATCH exacto de un campo, JWT, sin tenant ni Datos`, async t => {
    mockFetch(t, async (url, init) => {
      assert.equal(url, `/api/pet/admin/mascotas/10${change.flag === "reservaOnlineHabilitada" ? "/reserva-online" : ""}`);
      assert.equal(init.method, "PATCH"); assert.equal(init.cache, "no-store"); assert.equal(init.signal, undefined);
      assert.equal((init.headers as Record<string, string>).Authorization, "Bearer ADMIN_TEST_SENTINEL");
      assert.deepEqual(JSON.parse(String(init.body)), { [change.flag]: change.value });
      return ack(change);
    });
    assert.equal(await petMascotaFlagsService.update(10, { ...change, local_id: 9, nombre: "NO", servicios: [1] } as MascotaFlagChange), undefined);
  });

  test(`flags ${change.flag}=${change.value}: PATCH → GET autoritativo, sin reemplazar ficha con respuesta write`, async t => {
    const before = detail({ [change.flag]: !change.value, ...(change.flag === "reservaOnlineHabilitada" ? { activo: false } : {}) });
    const { controller, client, unavailable, confirmations } = setup(t, before);
    const key = queryKeys.petManagement.detail("L", 10); client.setQueryData(key, before);
    const observer = new QueryObserver(client, { ...petManagementDetailQuery("L", 10), enabled: false });
    const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe);
    const gate = deferred<Response>(); const calls: string[] = [];
    mockFetch(t, async (url, init) => {
      calls.push(`${init.method} ${url}`); return init.method === "PATCH" ? ack(change) : gate.promise;
    });
    const writing = controller.changeFlag(change.flag, change.value); await waitFor(() => calls.length === 2);
    assert.deepEqual(observer.getCurrentResult().data, before);
    const after = { ...before, [change.flag]: change.value, nombre: "Autoridad GET" };
    gate.resolve(json(dto(after))); assert.equal(await writing, true);
    assert.deepEqual(observer.getCurrentResult().data, after); assert.equal(controller.getSnapshot().pending, null);
    assert.equal(unavailable.length, 0); assert.equal(controller.getSnapshot().busy, false);
    assert.equal(confirmations.length, change.flag === "reservaOnlineHabilitada" || (change.flag === "activo" && !change.value) ? 1 : 0);
    assert.match(calls[0], /^PATCH /); assert.equal(calls[1], "GET /api/pet/admin/mascotas/10");
    if (change.flag === "altaExigencia" && change.value) assert.ok(controller.getSnapshot().notice?.includes(MASCOTA_HIGH_DEMAND_INFO));
  });
}

test("flags service: rechaza IDs/flags/boolean inválidos sin requests", async t => {
  let calls = 0; mockFetch(t, async () => { calls++; return json({}); });
  for (const id of [0, -1, 1.5, 2147483648, NaN]) await assert.rejects(petMascotaFlagsService.update(id, changes[0]), { status: 400 });
  for (const change of [{ flag: "activo", value: 1 }, { flag: "nombre", value: true }]) {
    await assert.rejects(petMascotaFlagsService.update(10, change as MascotaFlagChange), { status: 400 });
  }
  assert.equal(calls, 0);
});

test("flags service: ack malformado/no coincidente queda incierto; no acepta otra mascota ni online snake/número", async t => {
  let response = json({}); mockFetch(t, async () => response);
  for (const value of [json({}), json({ id: 20, activo: 0 }), json({ id: 10, activo: true }), json({ id: 10, activo: 1 }), json({ id: 10, activo: 0 }, 201), new Response("html")]) {
    response = value; await assert.rejects(petMascotaFlagsService.update(10, changes[0]));
  }
  for (const value of [json({ id: 10, reserva_online_habilitada: 0 }), json({ id: 10, reservaOnlineHabilitada: 0 }), json({ id: 10, reservaOnlineHabilitada: true })]) {
    response = value; await assert.rejects(petMascotaFlagsService.update(10, changes[4]));
  }
});

test("flags service: errores sanitizados, allowlist online real sin texto remoto", async t => {
  let response = json({ error: "PET_MASCOTA_RESERVA_ONLINE_CONFLICT" }, 409);
  mockFetch(t, async () => response);
  await assert.rejects(petMascotaFlagsService.update(10, changes[4]), { status: 409, code: "PET_MASCOTA_RESERVA_ONLINE_CONFLICT", message: "PET_MANAGEMENT_API_ERROR" });
  response = json({ error: "REMOTE_PRIVATE" }, 500);
  await assert.rejects(petMascotaFlagsService.update(10, changes[0]), { status: 500, code: null, message: "PET_MANAGEMENT_API_ERROR" });
});

test("inactiva + online=true: Reactivar bloqueado sin PATCH/GET ni cambios automáticos", async t => {
  const { controller, confirmations } = setup(t, detail({ activo: false, reservaOnlineHabilitada: true })); let calls = 0;
  mockFetch(t, async () => { calls++; return json({}); });
  assert.equal(await controller.changeFlag("activo", true), false); assert.equal(calls, 0); assert.equal(confirmations.length, 0);
  assert.equal(controller.getSnapshot().notice, MASCOTA_REACTIVATION_BLOCKED);
});

test("deshabilitar online y reactivar requieren dos decisiones explícitas, nunca un encadenamiento oculto", async t => {
  let remote = detail({ activo: false, reservaOnlineHabilitada: true });
  const { controller, confirmations } = setup(t, remote); const calls: string[] = [];
  mockFetch(t, async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (init.method !== "PATCH") return json(dto(remote));
    if (url.endsWith("/reserva-online")) { remote = { ...remote, reservaOnlineHabilitada: false }; return ack(changes[4]); }
    remote = { ...remote, activo: true }; return ack(changes[1]);
  });
  assert.equal(await controller.changeFlag("activo", true), false); assert.equal(calls.length, 0);
  assert.equal(await controller.changeFlag("reservaOnlineHabilitada", false), true);
  assert.deepEqual(calls, ["PATCH /api/pet/admin/mascotas/10/reserva-online", "GET /api/pet/admin/mascotas/10"]);
  assert.equal(remote.activo, false);
  assert.equal(await controller.changeFlag("activo", true), true); assert.equal(calls.length, 4); assert.equal(confirmations.length, 1);
});

test("online ya habilitada: no-op sin request", async t => {
    const { controller } = setup(t, detail({ reservaOnlineHabilitada: true, responsables: [] })); let calls = 0;
    mockFetch(t, async () => { calls++; return json({}); });
    assert.equal(await controller.changeFlag("reservaOnlineHabilitada", true), false); assert.equal(calls, 0);
    assert.equal(controller.getSnapshot().notice, null);
});

for (const [code, message] of [
  ["PET_ONLINE_REQUIRES_RESPONSIBLE", /responsable con teléfono válido.*Responsables/],
  ["PET_ONLINE_REQUIRES_SERVICE", /servicio permitido, activo y con duración válida.*Servicios/],
  ["PET_ONLINE_REQUIRES_HIGH_DEMAND_SETTINGS", /MIN_GAP o MAX_PER_DAY.*Configuración PET/],
  ["PET_MASCOTA_INACTIVE", /inactiva.*Reactivala/],
] as const) {
  test(`enable ${code}: backend decide, mensaje accionable, sin GET/retry/navegación`, async t => {
    const { controller } = setup(t, detail({ responsables: [] })); let calls = 0;
    mockFetch(t, async (_url, init) => { calls++; assert.equal(init.method, "PATCH"); return json({ error: code, private: "PRIVATE" }, 409); });
    assert.equal(await controller.changeFlag("reservaOnlineHabilitada", true), false);
    assert.equal(calls, 1); assert.match(controller.getSnapshot().errorMessage ?? "", message);
    assert.doesNotMatch(controller.getSnapshot().errorMessage ?? "", /PRIVATE/);
    assert.equal(controller.getSnapshot().pending, null); assert.equal(controller.getSnapshot().busy, false);
    assert.equal(window.location.href, "");
  });
}

test("alta exigencia sin settings/responsables: se permite; copy prudente no afirma elegibilidad online", async t => {
  const before = detail({ responsables: [] }); const { controller } = setup(t, before); const urls: string[] = [];
  mockFetch(t, async (url, init) => { urls.push(url); return init.method === "PATCH" ? ack(changes[2]) : json(dto({ ...before, altaExigencia: true })); });
  assert.equal(await controller.changeFlag("altaExigencia", true), true);
  assert.equal(urls.length, 2); assert.ok(urls.every(url => url === "/api/pet/admin/mascotas/10"));
  assert.ok(controller.getSnapshot().notice?.includes(MASCOTA_HIGH_DEMAND_INFO));
});

for (const change of [changes[0], changes[4]]) {
  test(`rechazar confirmación ${change.flag} no escribe ni refetchea`, async t => {
    const { controller, rejectConfirmation, confirmations } = setup(t, detail({ reservaOnlineHabilitada: true })); rejectConfirmation(); let calls = 0;
    mockFetch(t, async () => { calls++; return json({}); });
    assert.equal(await controller.changeFlag(change.flag, change.value), false); assert.equal(calls, 0); assert.equal(confirmations.length, 1);
  });
}

test("acciones no-op/sin selección/otro controller ocupado no escriben", async t => {
  let available = false; const { controller } = setup(t, detail(), () => available); let calls = 0;
  mockFetch(t, async () => { calls++; return json({}); });
  assert.equal(await controller.changeFlag("altaExigencia", true), false); available = true;
  for (const flag of ["activo", "altaExigencia", "reservaOnlineHabilitada"] as MascotaFlag[]) assert.equal(await controller.changeFlag(flag, detail()[flag]), false);
  controller.syncSelection(null, null); assert.equal(await controller.changeFlag("activo", false), false); assert.equal(calls, 0);
});

for (const change of recoveryChanges) {
  for (const failure of ["network", "500"] as const) {
    for (const applied of [true, false]) {
      test(`recovery ${change.flag} ${failure}, GET ${applied ? "aplicado" : "anterior"}: no replay, reintento solo explícito`, async t => {
        const before = detail({ [change.flag]: !change.value }); const { controller } = setup(t, before); let writes = 0; let gets = 0;
        mockFetch(t, async (_url, init) => {
          if (init.method === "PATCH") {
            writes++; if (writes > 1) return ack(change);
            if (failure === "network") throw new Error("PRIVATE"); return json({}, 500);
          }
          gets++; return json(dto({ ...before, [change.flag]: applied || writes > 1 ? change.value : !change.value }));
        });
        assert.equal(await controller.changeFlag(change.flag, change.value), applied);
        assert.equal(writes, 1); assert.equal(gets, 1); assert.equal(controller.getSnapshot().pending, null);
        if (applied) assert.ok(controller.getSnapshot().notice);
        else {
          assert.match(controller.getSnapshot().errorMessage ?? "", /estado anterior/);
          assert.equal(await controller.changeFlag(change.flag, change.value), true); assert.equal(writes, 2); assert.equal(gets, 2);
        }
      });
    }
  }

  test(`GET fallido ${change.flag}: conserva contexto incierto, bloquea PATCH y recheck solo lee`, async t => {
    const before = detail({ [change.flag]: !change.value }); const { controller } = setup(t, before); let writes = 0; let gets = 0;
    const gate = deferred<Response>();
    mockFetch(t, async (_url, init) => {
      if (init.method === "PATCH") { writes++; return ack(change); }
      gets++; return gets === 1 ? json({}, 500) : gate.promise;
    });
    assert.equal(await controller.changeFlag(change.flag, change.value), false);
    assert.equal(controller.getSnapshot().errorMessage, MASCOTA_FLAG_UNKNOWN); assert.deepEqual(controller.getSnapshot().pending, change);
    assert.equal(controller.getSnapshot().dirty, true);
    assert.equal(await controller.changeFlag("altaExigencia", true), false);
    const checking = controller.verify(); assert.equal(await controller.verify(), false);
    await waitFor(() => gets === 2); gate.resolve(json(dto({ ...before, [change.flag]: change.value })));
    assert.equal(await checking, true); assert.equal(writes, 1); assert.equal(gets, 2); assert.equal(controller.getSnapshot().dirty, false);
  });
}

test("doble click/Enter repetido y otra acción síncrona: un PATCH durante escritura y verificación", async t => {
  const { controller, confirmations } = setup(t); const patch = deferred<Response>(); const get = deferred<Response>(); let writes = 0; let gets = 0;
  mockFetch(t, async (_url, init) => { if (init.method === "PATCH") { writes++; return patch.promise; } gets++; return get.promise; });
  const changing = controller.changeFlag("activo", false);
  assert.equal(await controller.changeFlag("activo", false), false); assert.equal(await controller.changeFlag("altaExigencia", true), false);
  await waitFor(() => writes === 1); patch.resolve(ack(changes[0])); await waitFor(() => gets === 1);
  assert.equal(await controller.changeFlag("activo", false), false); assert.equal(await controller.verify(), false);
  get.resolve(json(dto(detail({ activo: false })))); assert.equal(await changing, true); assert.equal(writes, 1); assert.equal(confirmations.length, 1);
});

for (const status of [400, 401, 403]) {
  test(`flags PATCH ${status}: error controlado, sin retry ni GET, sin interpretar texto remoto`, async t => {
    const { controller } = setup(t); let calls = 0;
    mockFetch(t, async () => { calls++; return json({ error: "PRIVATE" }, status); });
    assert.equal(await controller.changeFlag("altaExigencia", true), false); assert.equal(calls, 1);
    assert.equal(controller.getSnapshot().pending, null); assert.doesNotMatch(controller.getSnapshot().errorMessage ?? "", /PRIVATE/);
    if (status === 401) { assert.equal(storage.has("token"), false); assert.equal(window.location.href, "/login"); }
  });
}

for (const failure of ["success", "network"] as const) {
  test(`PATCH tardío ${failure} de A no altera B ni inicia GET/recovery sobre B`, async t => {
    const { controller, unavailable } = setup(t); const gate = deferred<Response>(); let calls = 0;
    mockFetch(t, async () => { calls++; const response = await gate.promise; if (failure === "network") throw new Error("PRIVATE"); return response; });
    const writing = controller.changeFlag("activo", false); await waitFor(() => calls === 1);
    controller.syncSelection(20, detail({ id: 20, nombre: "B" })); gate.resolve(ack(changes[0]));
    assert.equal(await writing, false); assert.equal(calls, 1); assert.equal(controller.getSnapshot().pending, null);
    assert.equal(controller.getSnapshot().notice, null); assert.deepEqual(unavailable, []);
  });
}

for (const current of [true, false]) {
  test(`GET contextual 404 ${current ? "vigente" : "tardío"}: solo cierra selección vigente, nunca B`, async t => {
    const { controller, unavailable } = setup(t); const gate = deferred<Response>(); let gets = 0;
    mockFetch(t, async (_url, init) => { if (init.method === "PATCH") return json({}, 404); gets++; return gate.promise; });
    const writing = controller.changeFlag("activo", false); await waitFor(() => gets === 1);
    if (!current) controller.syncSelection(20, detail({ id: 20 }));
    gate.resolve(json({}, 404)); assert.equal(await writing, false); assert.deepEqual(unavailable, current ? [10] : []);
  });
}

test("GET pre-PATCH cancelado: respuesta vieja no revierte flags ya verificados", async t => {
  const { controller, client } = setup(t); const gate = deferred<Response>(); let gets = 0; let aborted = false;
  client.setQueryData(queryKeys.petManagement.detail("L", 10), detail());
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") return ack(changes[0]);
    gets++; if (gets === 1) { init.signal?.addEventListener("abort", () => { aborted = true; }); return gate.promise; }
    return json(dto(detail({ activo: false })));
  });
  const observer = new QueryObserver(client, petManagementDetailQuery("L", 10)); const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe);
  await waitFor(() => gets === 1); assert.equal(await controller.changeFlag("activo", false), true); assert.equal(aborted, true);
  gate.resolve(json(dto())); await nextTick(); assert.equal(observer.getCurrentResult().data?.activo, false); assert.equal(gets, 2);
});

test("StrictMode connect/cleanup no duplica PATCH; unmount ignora respuesta sin GET tardío", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let calls = 0;
  controller.disconnect(); controller.connect(); mockFetch(t, async () => { calls++; return gate.promise; });
  const writing = controller.changeFlag("altaExigencia", true); await waitFor(() => calls === 1);
  controller.disconnect(); gate.resolve(ack(changes[2])); assert.equal(await writing, false); assert.equal(calls, 1);
});

for (const change of recoveryChanges) {
  for (const uncertain of [false, true]) {
    test(`invalidaciones ${change.flag} ${uncertain ? "incierto" : "confirmado"}: solo caches dependientes de mascota, no BEAUTY/agenda/snapshots`, async t => {
      const client = makeClient(t);
      const always = [queryKeys.petManagement.detail("L", 10), queryKeys.petBooking.availability("slug", "S", 10, 1, [], "2026-10-20")];
      const search = [queryKeys.petManagement.search("L", "Firu", "activas", 20), queryKeys.petManagement.search("L", "Firu", "inactivas", 20),
        queryKeys.petManagement.search("L", "Firu", "todas", 20), queryKeys.petAdminBooking.searchMascotas("Firu", 20)];
      const listing = [queryKeys.petAdminBooking.mascotas(), queryKeys.petAdminBooking.mascotaDetail(10), queryKeys.petBooking.options("slug", "S", 10)];
      const availability = [queryKeys.petAdminBooking.availability(10, 1, [], "2026-10-20"), queryKeys.petAdminBooking.availability(10, 2, [3], "2026-10-21")];
      const unaffected = [queryKeys.petManagement.detail("OTHER", 10), queryKeys.petManagement.detail("L", 20), queryKeys.petManagement.search("OTHER", "Firu", "todas", 20),
        queryKeys.petAdminBooking.mascotaDetail(20), queryKeys.petAdminBooking.availability(20, 1, [], "2026-10-20"),
        queryKeys.petBooking.options("slug", "S", 20), queryKeys.petBooking.availability("slug", "S", 20, 1, [], "2026-10-20"),
        queryKeys.petBooking.creation("slug", "S"), queryKeys.clientes.all, queryKeys.turnos.all, queryKeys.petTurnos.fecha("2026-10-20"), queryKeys.petTurnoDisponibilidad.turnoFecha(1, "2026-10-20")];
      for (const key of [...always, ...search, ...listing, ...availability, ...unaffected]) client.setQueryData(key, { snapshot: "unchanged" });
      mockFetch(t, async () => uncertain ? json({}, 500) : ack(change));
      const mutation = updateMascotaFlagMutation(client, "L"); assert.equal(mutation.retry, false);
      const writing = new MutationObserver(client, mutation).mutate({ mascotaId: 10, change });
      if (uncertain) await assert.rejects(writing); else await writing;
      for (const key of always) assert.equal(client.getQueryState(key)?.isInvalidated, true);
      for (const key of search) assert.equal(client.getQueryState(key)?.isInvalidated, change.flag === "activo");
      for (const key of listing) assert.equal(client.getQueryState(key)?.isInvalidated, change.flag !== "altaExigencia");
      for (const key of availability) assert.equal(client.getQueryState(key)?.isInvalidated, change.flag !== "reservaOnlineHabilitada");
      for (const key of unaffected) assert.equal(client.getQueryState(key)?.isInvalidated, false);
      for (const key of [...always, ...search, ...listing, ...availability, ...unaffected]) assert.deepEqual(client.getQueryData(key), { snapshot: "unchanged" });
    });
  }
}

test("cambiar activo refetchea filtros Activas/Inactivas/Todas en ambos sentidos y conserva ficha seleccionada", async t => {
  let active = true; const { client, controller, unavailable } = setup(t);
  mockFetch(t, async (url, init) => {
    if (init.method === "PATCH") { active = JSON.parse(String(init.body)).activo; return ack({ flag: "activo", value: active }); }
    if (!url.includes("/search?")) return json(dto(detail({ activo: active })));
    const estado = new URL(url, "http://localhost").searchParams.get("estado");
    return json(estado === "todas" || (estado === "activas") === active ? [{ id: 10, nombre: "Firu", raza: "Mestizo", activo: active ? 1 : 0, responsables: [original] }] : []);
  });
  const observers = (["activas", "inactivas", "todas"] as const).map(estado => new QueryObserver(client, petManagementSearchQuery("L", "Firu", estado)));
  const subscriptions = observers.map(observer => observer.subscribe(() => {})); t.after(() => subscriptions.forEach(unsubscribe => unsubscribe()));
  await waitFor(() => observers.every(observer => observer.getCurrentResult().isSuccess));
  assert.deepEqual(observers.map(observer => observer.getCurrentResult().data?.length), [1, 0, 1]);
  assert.equal(await controller.changeFlag("activo", false), true);
  assert.deepEqual(observers.map(observer => observer.getCurrentResult().data?.length), [0, 1, 1]);
  assert.equal(await controller.changeFlag("activo", true), true);
  assert.deepEqual(observers.map(observer => observer.getCurrentResult().data?.length), [1, 0, 1]); assert.deepEqual(unavailable, []);
});

test("GET de flags preserva draft dirty de Datos y formulario Responsables, reutiliza remote-change protection", async t => {
  const { client, controller } = setup(t);
  const data = createPetMascotaFormController(client, { localId: "L", onSelect: () => {}, onUnavailable: () => {}, confirmDiscard: () => false });
  const responsables = createPetResponsablesController(client, { localId: "L", onUnavailable: () => {}, confirmDiscard: () => false, confirmRemove: () => true });
  t.after(() => { data.disconnect(); responsables.disconnect(); });
  data.syncSelection(10, detail()); data.beginEdit(detail()); data.change("raza", "Draft sin guardar");
  responsables.syncSelection(10, detail()); responsables.beginAdd(); responsables.change("nombre", "Draft responsable"); responsables.change("telefono", "11 2233 4455");
  const draftResponsable = responsables.getSnapshot();
  client.setQueryData(queryKeys.petManagement.detail("L", 10), detail());
  const observer = new QueryObserver(client, { ...petManagementDetailQuery("L", 10), enabled: false });
  const unsubscribe = observer.subscribe(result => { if (result.data) { data.syncSelection(10, result.data); responsables.syncSelection(10, result.data); } }); t.after(unsubscribe);
  mockFetch(t, async (_url, init) => init.method === "PATCH" ? ack(changes[2]) : json(dto(detail({ altaExigencia: true, observaciones: "Cambio remoto" }))));
  assert.equal(await controller.changeFlag("altaExigencia", true), true);
  assert.equal(data.getSnapshot().mode, "editing"); assert.equal(data.getSnapshot().draft.raza, "Draft sin guardar");
  assert.equal(data.getSnapshot().draft.observaciones, "Original"); assert.equal(data.getSnapshot().serverChanged, true);
  assert.deepEqual(responsables.getSnapshot(), draftResponsable);
  assert.equal(data.cancel(), false); assert.equal(data.getSnapshot().dirty, true);
});

test("contexto incierto de flags se compone con confirmación dirty existente, sin segundo guard", async t => {
  const { client, controller } = setup(t); let confirms = 0;
  const data = createPetMascotaFormController(client, { localId: "L", onSelect: () => {}, onUnavailable: () => {}, confirmDiscard: () => { confirms++; return false; } });
  t.after(() => data.disconnect()); data.syncSelection(10, detail()); data.beginEdit(detail()); data.change("raza", "Draft");
  mockFetch(t, async (_url, init) => init.method === "PATCH" ? ack(changes[0]) : json({}, 500));
  await controller.changeFlag("activo", false);
  assert.equal(data.selectMascota(20, controller.getSnapshot().dirty), false); assert.equal(confirms, 1);
  assert.equal(data.getSnapshot().draft.raza, "Draft"); assert.ok(controller.getSnapshot().pending);
});

test("copy/labels de acciones explícitas y confirmaciones explican preservación de datos", () => {
  assert.deepEqual(mascotaFlagLabels(detail(), "activo"), { title: "Estado", status: "Activa", action: "Desactivar" });
  assert.equal(mascotaFlagLabels(detail({ activo: false }), "activo").action, "Reactivar");
  assert.equal(mascotaFlagLabels(detail({ altaExigencia: true }), "altaExigencia").status, "Alta exigencia");
  assert.equal(mascotaFlagLabels(detail(), "reservaOnlineHabilitada").status, "Deshabilitada");
  assert.match(mascotaFlagConfirmation(changes[0], detail()), /requieren mascotas activas.*datos y relaciones se conservarán/);
  assert.match(mascotaFlagConfirmation(changes[4], detail()), /Deshabilitar la reserva online.*datos y relaciones se conservarán/);
  assert.match(mascotaFlagConfirmation(changes[5], detail()), /Habilitar la reserva online.*validarán/);
});
