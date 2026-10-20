import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
});

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
} });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const { petExtrasService, PetExtrasApiError } = await import("../src/feature/admin/petExtras/services/petExtras.service.ts");
const { petExtraMutationPolicy, petExtraWriteIsUncertain, petExtraWriteWithRecovery, petExtrasQuery } = await import("../src/feature/admin/petExtras/queries/petExtrasQueries.ts");
const { acquirePetExtraWriteLock, releasePetExtraWriteLock } = await import("../src/feature/admin/petExtras/queries/petExtraWriteLock.ts");
const { validatePetExtraNombre } = await import("../src/feature/admin/petExtras/types/petExtras.types.ts");
const { petExtraStatus, petExtrasCatalogState, petExtrasErrorMessage } = await import("../src/feature/admin/petExtras/components/petExtrasView.ts");
const { queryKeys } = await import("../src/shared/lib/queryKeys.ts");
const { getPetAdminContentKind } = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const dto = (id: number, nombre: string, activo: 0 | 1 = 1) => ({ id, nombre, activo });

function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_EXTRAS_TEST_TOKEN");
  window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}

test("GET Extras usa endpoint protegido, proyecta DTO, mantiene activos/inactivos y orden del backend", async t => {
  const expected = [dto(5, "Desenredado"), dto(7, "Tratamiento", 0), dto(8, "Uñas")];
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/extras"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer PET_EXTRAS_TEST_TOKEN");
    return json(expected);
  });
  assert.deepEqual(await petExtrasService.getPetExtras(), expected);
});

test("GET acepta vacío y proyecta exclusivamente campos del catálogo", async t => {
  let response = json([]); mockFetch(t, async () => response);
  assert.deepEqual(await petExtrasService.getPetExtras(), []);
  response = json([{ ...dto(1, "Baño"), local_id: 9, created_at: "ignored", duracionMinutos: 30, mascota_id: 2 }]);
  assert.deepEqual(await petExtrasService.getPetExtras(), [dto(1, "Baño")]);
  for (const payload of [[dto(1, "Baño", true)], {}, null]) {
    response = json(payload);
    await assert.rejects(petExtrasService.getPetExtras(), { status: 200 });
  }
});

test("POST recorta nombre, envía solo nombre y delega el duplicado al 409 del backend", async t => {
  const bodies: unknown[] = []; let calls = 0;
  mockFetch(t, async (url, init) => {
    calls++; assert.equal(url, "/api/pet/admin/extras"); assert.equal(init.method, "POST");
    bodies.push(JSON.parse(String(init.body)) as unknown);
    return calls === 1
      ? json(dto(calls, "Recuperación"), 201)
      : json({ error: "Ya existe un extra con ese nombre en tu local" }, 409);
  });
  assert.deepEqual(await petExtrasService.createPetExtra({ nombre: "  Recuperación  " }), dto(1, "Recuperación"));
  await assert.rejects(petExtrasService.createPetExtra({ nombre: "Recuperación" }), { status: 409 });
  assert.deepEqual(bodies, [{ nombre: "Recuperación" }, { nombre: "Recuperación" }]);
  await assert.rejects(petExtrasService.createPetExtra({ nombre: " " }), { status: 400 });
  await assert.rejects(petExtrasService.createPetExtra({ nombre: "x".repeat(101) }), { status: 400 });
  assert.equal(calls, 2);
});

test("PATCH envía nombre o activo únicamente, con 409 contractual y 404 preservados", async t => {
  const bodies: unknown[] = []; let status = 200;
  mockFetch(t, async (_url, init) => {
    const body = JSON.parse(String(init.body)) as { nombre?: string; activo?: boolean };
    bodies.push(body);
    if (status !== 200) return json({ error: "conflict" }, status);
    return json(dto(12, body.nombre ?? "Tratamiento", body.activo === false ? 0 : 1));
  });
  assert.deepEqual(await petExtrasService.updatePetExtra(12, { nombre: " Nuevo " }), dto(12, "Nuevo"));
  assert.deepEqual(await petExtrasService.updatePetExtra(12, { activo: false }), dto(12, "Tratamiento", 0));
  assert.deepEqual(await petExtrasService.updatePetExtra(12, { activo: true }), dto(12, "Tratamiento", 1));
  status = 409;
  await assert.rejects(petExtrasService.updatePetExtra(12, { nombre: "Duplicado" }), { status: 409 });
  status = 404;
  await assert.rejects(petExtrasService.updatePetExtra(12, { activo: false }), { status: 404 });
  assert.deepEqual(bodies, [{ nombre: "Nuevo" }, { activo: false }, { activo: true }, { nombre: "Duplicado" }, { activo: false }]);
});

test("validación nombre replica trim y límite Unicode del backend", () => {
  assert.equal(validatePetExtraNombre("  "), "Ingresá el nombre del extra.");
  assert.equal(validatePetExtraNombre("x".repeat(101)), "Usá hasta 100 caracteres.");
  assert.equal(validatePetExtraNombre("😀".repeat(100)), null);
  assert.equal(validatePetExtraNombre("😀".repeat(101)), "Usá hasta 100 caracteres.");
  assert.equal(validatePetExtraNombre("  Desenredado  "), null);
});

test("catálogo distingue loading/error/empty/list y el botón puede reintentar GET manualmente", async t => {
  assert.equal(petExtrasCatalogState({ isLoading: true, isError: false, data: undefined }), "loading");
  assert.equal(petExtrasCatalogState({ isLoading: false, isError: true, data: undefined }), "error");
  assert.equal(petExtrasCatalogState({ isLoading: false, isError: false, data: [] }), "empty");
  assert.equal(petExtrasCatalogState({ isLoading: false, isError: false, data: [dto(1, "X")] }), "list");
  assert.deepEqual(petExtraStatus(1), { label: "Activo", action: "Desactivar" });
  assert.deepEqual(petExtraStatus(0), { label: "Inactivo", action: "Activar" });

  const client = new QueryClient(); t.after(() => client.clear());
  let calls = 0;
  mockFetch(t, async () => (++calls === 1 ? json({ error: "temporary" }, 500) : json([])));
  const observer = new QueryObserver(client, petExtrasQuery("LOCAL"));
  const first = await observer.refetch();
  assert.equal(first.isError, true);
  assert.equal(petExtrasCatalogState({ isLoading: first.isLoading, isError: first.isError, data: first.data }), "error");
  const retried = await observer.refetch();
  assert.equal(retried.isSuccess, true);
  assert.deepEqual(retried.data, []);
  assert.equal(petExtrasCatalogState({ isLoading: retried.isLoading, isError: retried.isError, data: retried.data }), "empty");
  assert.equal(calls, 2);
});

test("errores enseñan duplicado contractual y no filtran mensajes remotos", () => {
  assert.equal(petExtrasErrorMessage(new PetExtrasApiError(409)), "Ya existe un extra con ese nombre en tu local");
  assert.match(petExtrasErrorMessage(new PetExtrasApiError(401)), /sesión/);
  assert.match(petExtrasErrorMessage(new PetExtrasApiError(403)), /permisos/);
  assert.match(petExtrasErrorMessage(new PetExtrasApiError(404)), /no está disponible/);
  assert.match(petExtrasErrorMessage(new PetExtrasApiError(500)), /Intentá nuevamente/);
  assert.ok(!petExtrasErrorMessage(new Error("REMOTE_SECRET" )).includes("REMOTE_SECRET"));
});

test("query keys separan catálogo global Extras de mascotaExtras y Servicios", () => {
  assert.deepEqual(queryKeys.petExtras.all("local-1"), ["pet-extras-catalog", "local-1"]);
  assert.notDeepEqual(queryKeys.petExtras.all("local-1"), queryKeys.petServicios.all("local-1"));
  assert.notDeepEqual(queryKeys.petExtras.all("local-1"), queryKeys.petAdminBooking.extras(1));
  assert.equal(petExtrasQuery("").enabled, false);
  assert.equal(petExtrasQuery("L").retry, false);
});

test("mutaciones desactivan retry automático y POST incierto hace una sola escritura más GET", async t => {
  assert.equal(petExtraMutationPolicy().retry, false);
  assert.equal(petExtraWriteIsUncertain(new PetExtrasApiError(0)), true);
  assert.equal(petExtraWriteIsUncertain(new PetExtrasApiError(500)), true);
  assert.equal(petExtraWriteIsUncertain(new PetExtrasApiError(201)), true);
  for (const status of [400, 401, 403, 404, 409]) assert.equal(petExtraWriteIsUncertain(new PetExtrasApiError(status)), false);

  const client = new QueryClient(); t.after(() => client.clear()); let writes = 0;
  const mutation = new MutationObserver(client, {
    mutationFn: async () => { writes++; throw new PetExtrasApiError(0); },
    ...petExtraMutationPolicy(),
  });
  await assert.rejects(mutation.mutate(undefined));
  assert.equal(writes, 1);

  const key = petExtrasQuery("LOCAL").queryKey;
  const current = [dto(20, "Otro")]; let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "POST") { writes++; return json({ error: "timeout" }, 500); }
    gets++; return json(current);
  });
  const result = await petExtraWriteWithRecovery(
    () => petExtrasService.createPetExtra({ nombre: "Draft" }),
    async () => { client.setQueryData(key, await petExtrasService.getPetExtras()); return true; },
  );
  assert.equal(result.kind, "uncertain");
  assert.equal(writes, 2);
  assert.equal(gets, 1);
  assert.deepEqual(client.getQueryData(key), current);
});

test("el lock síncrono bloquea un segundo submit antes del siguiente render", () => {
  const lock = { current: false };
  assert.equal(acquirePetExtraWriteLock(lock), true);
  assert.equal(acquirePetExtraWriteLock(lock), false);
  releasePetExtraWriteLock(lock);
  assert.equal(acquirePetExtraWriteLock(lock), true);
  releasePetExtraWriteLock(lock);
});

test("PATCH incierto reconsulta GET; 404 también refresca y el editor puede reconciliarse", async t => {
  const client = new QueryClient(); t.after(() => client.clear());
  const key = petExtrasQuery("LOCAL").queryKey;
  const authoritative = [dto(12, "Nombre actual", 0)]; let writes = 0; let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") { writes++; return json({ error: "temporary" }, 500); }
    gets++; return json(authoritative);
  });
  const uncertain = await petExtraWriteWithRecovery(
    () => petExtrasService.updatePetExtra(12, { nombre: "Draft local" }),
    async () => { client.setQueryData(key, await petExtrasService.getPetExtras()); return true; },
  );
  assert.equal(uncertain.kind, "uncertain");
  assert.equal(writes, 1); assert.equal(gets, 1);
  assert.deepEqual(client.getQueryData(key), authoritative);

  mockFetch(t, async (_url, init) => init.method === "PATCH"
    ? json({ error: "Extra no encontrado" }, 404)
    : (gets++, json([])));
  const missing = await petExtraWriteWithRecovery(
    () => petExtrasService.updatePetExtra(12, { activo: false }),
    async () => { await petExtrasService.getPetExtras(); return true; },
  );
  assert.equal(missing.kind, "not-found");
  assert.equal(missing.refreshed, true);
  assert.equal(gets, 2);
});

test("shell PET dirige Extras y Servicios a contenido real; otros tabs siguen placeholder", () => {
  assert.equal(getPetAdminContentKind("extras"), "extras");
  assert.equal(getPetAdminContentKind("servicios"), "servicios");
  assert.equal(getPetAdminContentKind("horarios"), "placeholder");
  assert.equal(getPetAdminContentKind("solicitudes"), "placeholder");
});

test("la capa de catálogo no ofrece delete ni campos de duración/precio/mascota", () => {
  assert.deepEqual(Object.keys(petExtrasService).sort(), ["createPetExtra", "getPetExtras", "updatePetExtra"]);
});
