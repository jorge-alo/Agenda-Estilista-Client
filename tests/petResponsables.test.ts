import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { setImmediate as nextTick } from "node:timers/promises";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
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
const { emptyResponsableDraft, normalizeResponsableDraft, validateResponsableDraft } = await import("../src/feature/admin/petManagement/forms/petResponsableForm.ts");
const { petResponsablesService } = await import("../src/feature/admin/petManagement/services/petResponsables.service.ts");
const { createPetResponsablesController, RESPONSABLE_CREATE_UNKNOWN, RESPONSABLE_EXISTING, RESPONSABLE_ASSOCIATION_UNKNOWN } = await import("../src/feature/admin/petManagement/state/petResponsablesController.ts");
const { createPetMascotaFormController } = await import("../src/feature/admin/petManagement/state/petMascotaFormController.ts");
const { createResponsableMutation, associateResponsableMutation, removeResponsableMutation } = await import("../src/feature/admin/petManagement/mutations/petResponsablesMutations.ts");
const { petManagementDetailQuery } = await import("../src/feature/admin/petManagement/queries/petManagementQueries.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");

const existing = { id: 55, nombre: "Nombre canónico", telefono: "11 2345 6789" };
const saved = { id: 77, nombre: "Guardado", telefono: "+54 11 2345 6790", isNew: true };
const draft = { nombre: " Nuevo ", telefono: " +54 11 2345 6790 " };
function detail(overrides: Partial<PetManagementDetail> = {}): PetManagementDetail {
  return { id: 10, nombre: "Firu", raza: "Mestizo", fechaNacimiento: null, sexo: null, tamano: null,
    tipoPelo: null, observaciones: "Original", activo: true, altaExigencia: false, reservaOnlineHabilitada: false,
    responsables: [existing], ...overrides };
}
function dto(value = detail()) {
  return { id: value.id, nombre: value.nombre, raza: value.raza, fecha_nacimiento: value.fechaNacimiento,
    sexo: value.sexo, tamano: value.tamano, tipo_pelo: value.tipoPelo, observaciones: value.observaciones,
    activo: value.activo ? 1 : 0, alta_exigencia: value.altaExigencia ? 1 : 0,
    reserva_online_habilitada: value.reservaOnlineHabilitada ? 1 : 0, responsables: value.responsables };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const relation = (status = 201) => json({ message: "Server text is not UI copy" }, status);
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "ADMIN_TEST_SENTINEL"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}
function makeClient(t: TestContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear()); return client;
}
function setup(t: TestContext, value = detail()) {
  const client = makeClient(t);
  const unavailable: number[] = [];
  const confirmations: Array<[number, string]> = [];
  let allowRemove = true; let allowDiscard = false;
  const controller = createPetResponsablesController(client, { localId: "L",
    onUnavailable: id => { unavailable.push(id); }, confirmDiscard: () => allowDiscard,
    confirmRemove: (responsable, name) => { confirmations.push([responsable.id, name]); return allowRemove; } });
  controller.syncSelection(value.id, value);
  t.after(() => controller.disconnect());
  return { client, controller, unavailable, confirmations,
    rejectRemoval: () => { allowRemove = false; }, allowDiscard: () => { allowDiscard = true; } };
}
function fill(controller: ReturnType<typeof createPetResponsablesController>) {
  controller.beginAdd(); controller.change("nombre", draft.nombre); controller.change("telefono", draft.telefono);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve };
}
async function waitFor(fn: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!fn()) { if (Date.now() > deadline) throw new Error("waitFor timeout"); await nextTick(); }
}

test("responsable helpers: trim, solo nombre/teléfono y límites reales, sin canonicalizar teléfono", () => {
  assert.deepEqual(normalizeResponsableDraft({ ...draft, local_id: 99 } as typeof draft), { nombre: "Nuevo", telefono: "+54 11 2345 6790" });
  assert.ok(validateResponsableDraft(emptyResponsableDraft()).nombre);
  assert.ok(validateResponsableDraft(emptyResponsableDraft()).telefono);
  assert.deepEqual(validateResponsableDraft({ nombre: "x".repeat(255), telefono: "x".repeat(50) }), {});
  assert.ok(validateResponsableDraft({ nombre: "x".repeat(256), telefono: "x".repeat(51) }).nombre);
  assert.ok(validateResponsableDraft({ nombre: "x".repeat(256), telefono: "x".repeat(51) }).telefono);
  assert.deepEqual(validateResponsableDraft({ nombre: "Ana", telefono: "backend decide" }), {});
});

test("service crear/reutilizar: POST exacto, JWT, proyección canónica, sin tenant ni flags", async t => {
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/responsables"); assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store"); assert.equal(init.signal, undefined);
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer ADMIN_TEST_SENTINEL");
    assert.deepEqual(JSON.parse(String(init.body)), { nombre: "Nuevo", telefono: "+54 11 2345 6790" });
    return json({ ...existing, isNew: false, local_id: 9, created_at: "ignored" });
  });
  const result = await petResponsablesService.createResponsable({ ...draft, local_id: 999, activo: true } as typeof draft);
  assert.deepEqual(result, { ...existing, isNew: false });
});

test("service asociación y DELETE: rutas/IDs/body exactos; nunca DELETE de cliente", async t => {
  const calls: string[] = [];
  mockFetch(t, async (url, init) => {
    calls.push(url); assert.equal(init.cache, "no-store");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer ADMIN_TEST_SENTINEL");
    if (init.method === "POST") { assert.deepEqual(JSON.parse(String(init.body)), { clienteId: 55 }); return relation(); }
    assert.equal(init.method, "DELETE"); assert.equal(init.body, undefined); return relation(200);
  });
  await petResponsablesService.associateResponsable(10, 55);
  await petResponsablesService.removeResponsable(10, 55);
  assert.deepEqual(calls, ["/api/pet/admin/mascotas/10/responsables", "/api/pet/admin/mascotas/10/responsables/55"]);
});

test("service valida IDs sin request y rechaza respuestas write incompatibles", async t => {
  let response = json({ ...saved, id: 0 }, 201); let calls = 0;
  mockFetch(t, async () => { calls++; return response; });
  await assert.rejects(petResponsablesService.associateResponsable(-1, 55), { status: 400 });
  await assert.rejects(petResponsablesService.removeResponsable(10, 0), { status: 400 });
  assert.equal(calls, 0);
  for (const value of [json({ ...saved, id: 0 }, 201), json({ ...saved, isNew: false }, 201), json(saved, 200), json({ id: 77 }, 201), new Response("html", { status: 201 })]) {
    response = value; await assert.rejects(petResponsablesService.createResponsable(draft));
  }
  response = relation(200); await assert.rejects(petResponsablesService.associateResponsable(10, 55), { status: 200 });
  response = json({}); await assert.rejects(petResponsablesService.removeResponsable(10, 55), { status: 200 });
});

test("service errores sanitizados: allowlist teléfono, sin copiar texto arbitrario", async t => {
  let response = json({ error: "CLIENT_PHONE_INVALID" }, 400);
  mockFetch(t, async () => response);
  await assert.rejects(petResponsablesService.createResponsable(draft), { status: 400, code: "CLIENT_PHONE_INVALID", message: "PET_MANAGEMENT_API_ERROR" });
  response = json({ error: "CLIENT_PHONE_CONFLICT" }, 409);
  await assert.rejects(petResponsablesService.createResponsable(draft), { status: 409, code: "CLIENT_PHONE_CONFLICT" });
  response = json({ error: "REMOTE_PRIVATE" }, 409);
  await assert.rejects(petResponsablesService.associateResponsable(10, 55), { status: 409, code: null, message: "PET_MANAGEMENT_API_ERROR" });
});

test("nuevo: dos POST secuenciales y GET autoritativo, sin construir ficha con write responses", async t => {
  const { controller, client } = setup(t);
  const key = queryKeys.petManagement.detail("L", 10); client.setQueryData(key, detail());
  const observer = new QueryObserver(client, { ...petManagementDetailQuery("L", 10), enabled: false });
  const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe);
  const gate = deferred<Response>(); const events: string[] = [];
  mockFetch(t, async (url, init) => {
    events.push(`${init.method} ${url}`);
    if (url === "/api/pet/admin/responsables") return json(saved, 201);
    if (init.method === "POST") return relation();
    return gate.promise;
  });
  fill(controller); const submitting = controller.submit();
  await waitFor(() => events.length === 3);
  assert.equal(controller.getSnapshot().mode, "checking");
  assert.deepEqual(observer.getCurrentResult().data?.responsables, [existing]);
  gate.resolve(json(dto(detail({ responsables: [existing, { ...saved, nombre: "Autoridad GET" }] }))));
  assert.equal(await submitting, true);
  assert.equal(observer.getCurrentResult().data?.responsables[1].nombre, "Autoridad GET");
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.deepEqual(events, ["POST /api/pet/admin/responsables", "POST /api/pet/admin/mascotas/10/responsables", "GET /api/pet/admin/mascotas/10"]);
});

test("existente 200/isNew=false conserva nombre canónico, informa reutilización y asocia ID devuelto", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let links = 0;
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") return json({ ...existing, isNew: false });
    if (init.method === "POST") { links++; assert.deepEqual(JSON.parse(String(init.body)), { clienteId: 55 }); return gate.promise; }
    return json(dto());
  });
  fill(controller); const submitting = controller.submit(); await waitFor(() => links === 1);
  assert.equal(controller.getSnapshot().notice, RESPONSABLE_EXISTING);
  assert.equal(controller.getSnapshot().confirmed?.nombre, existing.nombre);
  gate.resolve(relation()); assert.equal(await submitting, true);
  assert.match(controller.getSnapshot().notice ?? "", /existente.*no fueron modificados/);
});

test("doble submit síncrono durante ambos POST queda bloqueado, sin requests paralelas", async t => {
  const { controller } = setup(t); const first = deferred<Response>(); const second = deferred<Response>(); const calls: string[] = [];
  mockFetch(t, async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url === "/api/pet/admin/responsables") return first.promise;
    if (init.method === "POST") return second.promise;
    return json(dto(detail({ responsables: [saved] })));
  });
  fill(controller); const submitting = controller.submit();
  assert.equal(await controller.submit(), false); assert.equal(controller.cancel(), false);
  assert.equal(await controller.removeResponsable(55), false);
  await waitFor(() => calls.length === 1); assert.equal(controller.getSnapshot().mode, "creating");
  first.resolve(json(saved, 201)); await waitFor(() => calls.length === 2);
  assert.equal(controller.getSnapshot().mode, "associating"); assert.equal(await controller.submit(), false);
  second.resolve(relation()); assert.equal(await submitting, true); assert.equal(calls.length, 3);
});

for (const field of ["nombre", "telefono"] as const) {
  test(`validación ${field} vacío conserva draft y no ejecuta POST`, async t => {
    const { controller } = setup(t); let calls = 0;
    mockFetch(t, async () => { calls++; return json({}); });
    fill(controller); controller.change(field, "  ");
    assert.equal(await controller.submit(), false); assert.ok(controller.getSnapshot().errors[field]);
    assert.equal(controller.getSnapshot().draft[field], "  "); assert.equal(calls, 0);
  });
}

for (const failure of ["network", "500"] as const) {
  test(`asociación ${failure}: conserva clienteId; recovery solo reintenta asociación, no creación`, async t => {
    const { controller } = setup(t); let creates = 0; let links = 0; let gets = 0;
    mockFetch(t, async (url, init) => {
      if (url === "/api/pet/admin/responsables") { creates++; return json(saved, 201); }
      if (init.method === "POST") {
        links++; if (links > 1) return relation();
        if (failure === "network") throw new Error("PRIVATE"); return json({}, 500);
      }
      gets++; return json(dto(detail({ responsables: links > 1 ? [saved] : [] })));
    });
    fill(controller); assert.equal(await controller.submit(), false);
    assert.equal(controller.getSnapshot().confirmed?.id, 77);
    assert.equal(controller.getSnapshot().errorMessage, RESPONSABLE_ASSOCIATION_UNKNOWN);
    controller.change("telefono", "NO cambiar ID confirmado"); assert.equal(controller.getSnapshot().draft.telefono, draft.telefono);
    assert.equal(creates, 1); assert.equal(links, 1); assert.equal(gets, 1);
    assert.equal(await controller.submit(), true);
    assert.equal(creates, 1); assert.equal(links, 2); assert.equal(gets, 2);
  });

  test(`primer POST ${failure}: resultado incierto, formulario intacto, sin retry; reenvío explícito reutiliza backend`, async t => {
    const { controller } = setup(t); let creates = 0; let links = 0; let gets = 0;
    mockFetch(t, async (url, init) => {
      if (url === "/api/pet/admin/responsables") {
        creates++; if (creates > 1) return json({ ...saved, isNew: false });
        if (failure === "network") throw new Error("PRIVATE"); return json({}, 500);
      }
      if (init.method === "POST") { links++; return relation(); }
      gets++; return json(dto(detail({ responsables: [saved] })));
    });
    fill(controller); assert.equal(await controller.submit(), false);
    assert.equal(controller.getSnapshot().errorMessage, RESPONSABLE_CREATE_UNKNOWN);
    assert.deepEqual(controller.getSnapshot().draft, draft); assert.equal(controller.getSnapshot().confirmed, null);
    assert.equal(creates, 1); assert.equal(links, 0); assert.equal(gets, 0);
    assert.equal(await controller.submit(), true); assert.equal(creates, 2); assert.equal(links, 1); assert.equal(gets, 1);
  });
}

for (const associated of [true, false]) {
  test(`409 asociación: GET ${associated ? "confirma" : "no confirma"}; no asume corrupción ni éxito`, async t => {
    const { controller } = setup(t); let gets = 0; let links = 0;
    mockFetch(t, async (url, init) => {
      if (url === "/api/pet/admin/responsables") return json({ ...existing, isNew: false });
      if (init.method === "POST") { links++; return json({ error: "arbitrary conflict" }, 409); }
      gets++; return json(dto(detail({ responsables: associated ? [existing] : [] })));
    });
    fill(controller); assert.equal(await controller.submit(), associated);
    assert.equal(controller.getSnapshot().mode, associated ? "viewing" : "adding");
    if (!associated) { assert.equal(controller.getSnapshot().confirmed?.id, 55); assert.equal(controller.getSnapshot().errorMessage, RESPONSABLE_ASSOCIATION_UNKNOWN); }
    assert.equal(gets, 1); assert.equal(links, 1);
  });
}

test("asociación confirmada + GET fallido: bloquea nuevo POST hasta verificar, sin perder clienteId", async t => {
  const { controller } = setup(t); let creates = 0; let links = 0; let gets = 0;
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") { creates++; return json(saved, 201); }
    if (init.method === "POST") { links++; return relation(); }
    gets++; return gets === 1 ? json({}, 500) : json(dto(detail({ responsables: [saved] })));
  });
  fill(controller); assert.equal(await controller.submit(), false);
  assert.ok(controller.getSnapshot().verification); assert.equal(controller.getSnapshot().confirmed?.id, 77);
  assert.equal(await controller.submit(), false);
  assert.equal(await controller.verify(), true);
  assert.equal(creates, 1); assert.equal(links, 1); assert.equal(gets, 2);
});

test("asociación incierta aplicada: GET confirma y cierra sin repetir ninguna escritura", async t => {
  const { controller } = setup(t); let creates = 0; let links = 0; let gets = 0;
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") { creates++; return json(saved, 201); }
    if (init.method === "POST") { links++; throw new Error("network after write"); }
    gets++; return json(dto(detail({ responsables: [saved] })));
  });
  fill(controller); assert.equal(await controller.submit(), true);
  assert.equal(controller.getSnapshot().mode, "viewing");
  assert.equal(creates, 1); assert.equal(links, 1); assert.equal(gets, 1);
});

test("quitar pide confirmación de relación, no elimina cliente; DELETE exitoso refetchea GET", async t => {
  const { controller, confirmations, rejectRemoval } = setup(t); const calls: string[] = [];
  mockFetch(t, async (url, init) => { calls.push(`${init.method} ${url}`); return init.method === "DELETE" ? relation(200) : json(dto(detail({ responsables: [] }))); });
  assert.equal(await controller.removeResponsable(55), true);
  assert.deepEqual(confirmations, [[55, "Firu"]]);
  assert.deepEqual(calls, ["DELETE /api/pet/admin/mascotas/10/responsables/55", "GET /api/pet/admin/mascotas/10"]);
  assert.match(controller.getSnapshot().notice ?? "", /sigue en el sistema/);
  controller.syncSelection(10, detail()); rejectRemoval(); assert.equal(await controller.removeResponsable(55), false);
  assert.equal(calls.length, 2);
});

for (const failure of ["network", "500", "404"] as const) {
  for (const removed of [true, false]) {
    test(`DELETE ${failure}: GET ${removed ? "ausente reconcilia" : "presente conserva"}, sin repetir DELETE`, async t => {
      const { controller } = setup(t); let writes = 0; let gets = 0;
      mockFetch(t, async (_url, init) => {
        if (init.method === "DELETE") { writes++; if (failure === "network") throw new Error("PRIVATE"); return json({}, Number(failure)); }
        gets++; return json(dto(detail({ responsables: removed ? [] : [existing] })));
      });
      assert.equal(await controller.removeResponsable(55), removed);
      assert.equal(writes, 1); assert.equal(gets, 1); assert.equal(controller.getSnapshot().mode, "viewing");
      if (!removed) assert.match(controller.getSnapshot().errorMessage ?? "", /todavía muestra/);
    });
  }
}

test("DELETE incierto + GET fallido: verificar solo lee, reintento DELETE explícito si sigue asociado", async t => {
  const { controller } = setup(t); let writes = 0; let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "DELETE") { writes++; return writes === 1 ? json({}, 500) : relation(200); }
    gets++; return gets === 1 ? json({}, 500) : json(dto(detail({ responsables: writes === 1 ? [existing] : [] })));
  });
  assert.equal(await controller.removeResponsable(55), false);
  assert.ok(controller.getSnapshot().verification); assert.equal(await controller.removeResponsable(55), false);
  assert.equal(await controller.verify(), false); assert.equal(controller.getSnapshot().verification, null);
  assert.equal(writes, 1); assert.equal(gets, 2);
  assert.equal(await controller.removeResponsable(55), true); assert.equal(writes, 2); assert.equal(gets, 3);
});

test("doble Quitar mientras DELETE pendiente hace una sola confirmación/request", async t => {
  const { controller, confirmations } = setup(t); const gate = deferred<Response>(); let writes = 0;
  mockFetch(t, async (_url, init) => { if (init.method === "DELETE") { writes++; return gate.promise; } return json(dto(detail({ responsables: [] }))); });
  const removing = controller.removeResponsable(55);
  assert.equal(await controller.removeResponsable(55), false); assert.equal(controller.beginAdd(), false);
  await waitFor(() => writes === 1); gate.resolve(relation(200)); assert.equal(await removing, true);
  assert.equal(confirmations.length, 1); assert.equal(writes, 1);
});

test("verificación cancela un GET previo al DELETE; su respuesta tardía no repone al responsable", async t => {
  const { controller, client } = setup(t); const gate = deferred<Response>(); let gets = 0; let aborted = false;
  client.setQueryData(queryKeys.petManagement.detail("L", 10), detail());
  mockFetch(t, async (_url, init) => {
    if (init.method === "DELETE") return relation(200);
    gets++;
    if (gets === 1) { init.signal?.addEventListener("abort", () => { aborted = true; }); return gate.promise; }
    return json(dto(detail({ responsables: [] })));
  });
  const observer = new QueryObserver(client, petManagementDetailQuery("L", 10));
  const unsubscribe = observer.subscribe(() => {}); t.after(unsubscribe);
  await waitFor(() => gets === 1);
  assert.equal(await controller.removeResponsable(55), true); assert.equal(aborted, true); assert.equal(gets, 2);
  gate.resolve(json(dto())); await nextTick();
  assert.deepEqual(observer.getCurrentResult().data?.responsables, []);
});

test("sin restricción nueva: agregar y quitar también funciona para mascota inactiva", async t => {
  const { controller } = setup(t, detail({ activo: false })); let creates = 0;
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") { creates++; return json(saved, 201); }
    if (init.method === "POST") return relation();
    return init.method === "DELETE" ? relation(200) : json(dto(detail({ activo: false, responsables: creates ? [existing, saved] : [] })));
  });
  fill(controller); assert.equal(await controller.submit(), true); creates = 0;
  assert.equal(await controller.removeResponsable(55), true);
});

for (const stage of ["create", "associate", "remove"] as const) {
  for (const status of [401, 403]) {
    test(`${stage} ${status}: conserva contexto, auth estándar, sin recovery ni retry`, async t => {
      const { controller } = setup(t); const calls: string[] = [];
      mockFetch(t, async (url, init) => {
        calls.push(`${init.method} ${url}`);
        if (stage === "associate" && url === "/api/pet/admin/responsables") return json(saved, 201);
        return json({ error: "PRIVATE" }, status);
      });
      if (stage !== "remove") fill(controller);
      assert.equal(await (stage === "remove" ? controller.removeResponsable(55) : controller.submit()), false);
      assert.equal(calls.length, stage === "associate" ? 2 : 1);
      assert.match(controller.getSnapshot().errorMessage ?? "", status === 401 ? /sesión/ : /permisos/);
      assert.equal(controller.getSnapshot().verification, null);
      if (stage === "associate") assert.equal(controller.getSnapshot().confirmed?.id, 77);
      if (status === 401) { assert.equal(storage.has("token"), false); assert.equal(window.location.href, "/login"); }
    });
  }
}

test("primer POST 400/409/malformado conserva formulario; no usa textos remotos ni inventa ID", async t => {
  const { controller } = setup(t); let response = json({ error: "CLIENT_PHONE_INVALID" }, 400); let calls = 0;
  mockFetch(t, async () => { calls++; return response; });
  fill(controller); await controller.submit(); assert.match(controller.getSnapshot().errorMessage ?? "", /teléfono/);
  response = json({ error: "PRIVATE" }, 409); await controller.submit(); assert.match(controller.getSnapshot().errorMessage ?? "", /conflicto/);
  response = json({ id: 77 }, 201); await controller.submit(); assert.equal(controller.getSnapshot().errorMessage, RESPONSABLE_CREATE_UNKNOWN);
  assert.equal(controller.getSnapshot().confirmed, null); assert.deepEqual(controller.getSnapshot().draft, draft); assert.equal(calls, 3);
});

test("mutations retry false; crear solo no invalida búsquedas de mascotas", async t => {
  const client = makeClient(t);
  const key = queryKeys.petManagement.search("L", "Ana", "todas", 20); client.setQueryData(key, []);
  for (const factory of [createResponsableMutation, associateResponsableMutation, removeResponsableMutation]) assert.equal(factory(client, "L").retry, false);
  mockFetch(t, async () => json(saved, 201));
  await new MutationObserver(client, createResponsableMutation(client, "L")).mutate(draft);
  assert.equal(client.getQueryState(key)?.isInvalidated, false);
});

for (const operation of ["associate", "remove"] as const) {
  test(`invalidaciones ${operation}: detail exacto/search PET/booking; sin BEAUTY, agenda ni snapshots históricos`, async t => {
    const client = makeClient(t);
    const affected = [queryKeys.petManagement.detail("L", 10), queryKeys.petManagement.search("L", "Ana", "todas", 20),
      queryKeys.petManagement.search("L", "1123", "inactivas", 20), queryKeys.petAdminBooking.searchMascotas("Ana", 20),
      queryKeys.petAdminBooking.mascotaDetail(10)];
    const untouched = [queryKeys.petManagement.detail("L", 20), queryKeys.petManagement.detail("OTHER", 10),
      queryKeys.petManagement.search("OTHER", "Ana", "todas", 20), queryKeys.petAdminBooking.mascotaDetail(20),
      queryKeys.petAdminBooking.mascotas(), queryKeys.clientes.all, queryKeys.turnos.all, queryKeys.petTurnos.fecha("2026-10-20")];
    for (const key of [...affected, ...untouched]) client.setQueryData(key, { snapshot: "unchanged" });
    mockFetch(t, async () => relation(operation === "associate" ? 201 : 200));
    const mutation = operation === "associate" ? associateResponsableMutation(client, "L") : removeResponsableMutation(client, "L");
    await new MutationObserver(client, mutation).mutate({ mascotaId: 10, clienteId: 55 });
    for (const key of affected) assert.equal(client.getQueryState(key)?.isInvalidated, true);
    for (const key of untouched) assert.equal(client.getQueryState(key)?.isInvalidated, false);
    for (const key of [...affected, ...untouched]) assert.deepEqual(client.getQueryData(key), { snapshot: "unchanged" });
  });
}

test("respuesta tardía del primer POST de A no asocia en A ni altera selección B", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let calls = 0;
  mockFetch(t, async () => { calls++; return gate.promise; });
  fill(controller); const submitting = controller.submit(); await waitFor(() => calls === 1);
  controller.syncSelection(20, detail({ id: 20, nombre: "B" }));
  gate.resolve(json(saved, 201)); assert.equal(await submitting, false);
  assert.equal(calls, 1); assert.equal(controller.getSnapshot().mode, "viewing"); assert.equal(controller.getSnapshot().confirmed, null);
});

test("respuesta tardía de asociación de A no inicia GET/recovery sobre B", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let links = 0; let gets = 0;
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") return json(saved, 201);
    if (init.method === "POST") { links++; return gate.promise; }
    gets++; return json(dto());
  });
  fill(controller); const submitting = controller.submit(); await waitFor(() => links === 1);
  controller.syncSelection(20, detail({ id: 20 })); gate.resolve(json({}, 500));
  assert.equal(await submitting, false); assert.equal(gets, 0); assert.equal(controller.getSnapshot().errorMessage, null);
});

test("GET contextual 404 vigente cierra solo A; 404 tardío de A no cierra B", async t => {
  const { controller, unavailable } = setup(t); const gate = deferred<Response>(); let gets = 0;
  mockFetch(t, async (_url, init) => { if (init.method === "DELETE") return relation(200); gets++; return gate.promise; });
  const removing = controller.removeResponsable(55); await waitFor(() => gets === 1);
  controller.syncSelection(20, detail({ id: 20 })); gate.resolve(json({}, 404)); await removing;
  assert.deepEqual(unavailable, []);
  mockFetch(t, async (_url, init) => init.method === "DELETE" ? relation(200) : json({}, 404));
  await controller.removeResponsable(55); assert.deepEqual(unavailable, [20]);
});

test("StrictMode connect/cleanup no duplica operación; unmount durante create impide asociación tardía", async t => {
  const { controller } = setup(t); const gate = deferred<Response>(); let calls = 0;
  controller.disconnect(); controller.connect();
  mockFetch(t, async () => { calls++; return gate.promise; });
  fill(controller); const submitting = controller.submit(); await waitFor(() => calls === 1);
  controller.disconnect(); gate.resolve(json(saved, 201)); assert.equal(await submitting, false); assert.equal(calls, 1);
});

test("cancelar alta protege contexto; navegación compone dirty Datos/Responsables con una sola confirmación", t => {
  const { controller, client, allowDiscard } = setup(t); fill(controller);
  assert.equal(controller.cancel(), false); assert.deepEqual(controller.getSnapshot().draft, draft);
  let confirms = 0; let discard = false;
  const data = createPetMascotaFormController(client, { localId: "L", onSelect: () => {}, onUnavailable: () => {},
    confirmDiscard: () => { confirms++; return discard; } });
  data.syncSelection(10, detail()); data.beginEdit(detail()); data.change("raza", "Caniche A");
  assert.equal(data.selectMascota(20, controller.getSnapshot().dirty), false); assert.equal(confirms, 1);
  assert.equal(data.getSnapshot().draft.raza, "Caniche A");
  discard = true; assert.equal(data.beginCreate(controller.getSnapshot().dirty), true); assert.equal(confirms, 2);
  allowDiscard(); assert.equal(controller.cancel(), true); data.disconnect();
});

test("Responsables opera independiente: refetch preserva draft dirty de Datos y detecta otro cambio remoto sin merge", async t => {
  const { controller, client } = setup(t);
  const data = createPetMascotaFormController(client, { localId: "L", onSelect: () => {}, onUnavailable: () => {}, confirmDiscard: () => false });
  t.after(() => data.disconnect()); data.syncSelection(10, detail()); data.beginEdit(detail()); data.change("raza", "Caniche A");
  client.setQueryData(queryKeys.petManagement.detail("L", 10), detail());
  const observer = new QueryObserver(client, { ...petManagementDetailQuery("L", 10), enabled: false });
  const unsubscribe = observer.subscribe(result => { if (result.data) data.syncSelection(10, result.data); }); t.after(unsubscribe);
  mockFetch(t, async (url, init) => {
    if (url === "/api/pet/admin/responsables") return json(saved, 201);
    if (init.method === "POST") return relation();
    return json(dto(detail({ observaciones: "Desde otra pestaña", responsables: [existing, saved] })));
  });
  fill(controller); assert.equal(await controller.submit(), true);
  assert.equal(data.getSnapshot().draft.raza, "Caniche A"); assert.equal(data.getSnapshot().draft.observaciones, "Original");
  assert.equal(data.getSnapshot().dirty, true); assert.equal(data.getSnapshot().serverChanged, true);
});
