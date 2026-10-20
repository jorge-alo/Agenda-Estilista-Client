import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { MutationObserver, QueryClient } from "@tanstack/react-query";

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

const { petServiciosService, PetServiciosApiError } = await import("../src/feature/admin/petServicios/services/petServicios.service.ts");
const { petServicioMutationPolicy, petServicioWriteIsUncertain, petServicioWriteWithRecovery, petServiciosQuery } = await import("../src/feature/admin/petServicios/queries/petServiciosQueries.ts");
const { validatePetServicioNombre } = await import("../src/feature/admin/petServicios/types/petServicios.types.ts");
const { petServicioStatus, petServiciosCatalogState, petServiciosErrorMessage } = await import("../src/feature/admin/petServicios/components/petServiciosView.ts");

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const dto = (id: number, nombre: string, activo = 1) => ({ id, nombre, activo });

function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_SERVICES_TEST_TOKEN");
  window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}

test("GET Servicios PET lee el DTO reducido, activos/inactivos y orden recibido sin transformar", async t => {
  const expected = [dto(5, "Baño"), dto(7, "Baño", 0), dto(8, "Stripping")];
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/servicios"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer PET_SERVICES_TEST_TOKEN");
    return json(expected);
  });
  assert.deepEqual(await petServiciosService.getPetServicios(), expected);
});

test("GET acepta catálogo vacío y solo proyecta el DTO de catálogo", async t => {
  let response = json([]); mockFetch(t, async () => response);
  assert.deepEqual(await petServiciosService.getPetServicios(), []);
  response = json([{ ...dto(1, "Baño"), precio: 0, duracion: 30, local_id: 9, created_at: "now", business_type: "BEAUTY" }]);
  assert.deepEqual(await petServiciosService.getPetServicios(), [dto(1, "Baño")]);
  response = json([dto(1, "Baño", true)]);
  await assert.rejects(petServiciosService.getPetServicios(), { status: 200 });
});

test("POST trimmea, envía únicamente nombre, acepta duplicados y valida 1–100 antes de request", async t => {
  const bodies: unknown[] = []; let calls = 0;
  mockFetch(t, async (url, init) => {
    calls++; assert.equal(url, "/api/pet/admin/servicios"); assert.equal(init.method, "POST");
    const body = JSON.parse(String(init.body)) as unknown; bodies.push(body);
    return json(dto(calls, "Baño"), 201);
  });
  assert.deepEqual(await petServiciosService.createPetServicio({ nombre: "  Baño  " }), dto(1, "Baño"));
  assert.deepEqual(await petServiciosService.createPetServicio({ nombre: "Baño" }), dto(2, "Baño"));
  assert.deepEqual(bodies, [{ nombre: "Baño" }, { nombre: "Baño" }]);
  await assert.rejects(petServiciosService.createPetServicio({ nombre: "  " }), { status: 400 });
  await assert.rejects(petServiciosService.createPetServicio({ nombre: "x".repeat(101) }), { status: 400 });
  assert.equal(calls, 2);
});

test("PATCH nombre/activo envían exactamente el campo modificado y validan IDs/valores localmente", async t => {
  const bodies: unknown[] = []; const paths: string[] = [];
  mockFetch(t, async (url, init) => {
    paths.push(`${init.method} ${url}`); const body = JSON.parse(String(init.body)) as Record<string, unknown>; bodies.push(body);
    const id = Number(url.split("/").at(-1)); return json(dto(id, "Nombre autoritativo", body.activo === false ? 0 : 1));
  });
  assert.deepEqual(await petServiciosService.updatePetServicio(12, { nombre: " Nuevo " }), dto(12, "Nombre autoritativo"));
  assert.deepEqual(await petServiciosService.updatePetServicio(12, { activo: false }), dto(12, "Nombre autoritativo", 0));
  assert.deepEqual(await petServiciosService.updatePetServicio(12, { activo: true }), dto(12, "Nombre autoritativo", 1));
  assert.deepEqual(paths, Array(3).fill("PATCH /api/pet/admin/servicios/12"));
  assert.deepEqual(bodies, [{ nombre: "Nuevo" }, { activo: false }, { activo: true }]);
  const calls = 3;
  await assert.rejects(petServiciosService.updatePetServicio(0, { activo: false }), { status: 400 });
  await assert.rejects(petServiciosService.updatePetServicio(12, { activo: 1 } as never), { status: 400 });
  await assert.rejects(petServiciosService.updatePetServicio(12, { nombre: "  " }), { status: 400 });
  assert.equal(calls, 3);
});

test("errores de transporte no exponen contenido remoto y 401 conserva manejo central", async t => {
  mockFetch(t, async () => { throw new Error("PRIVATE_TRANSPORT_DETAIL"); });
  await assert.rejects(petServiciosService.createPetServicio({ nombre: "Baño" }), error => {
    assert.ok(error instanceof PetServiciosApiError); assert.equal(error.status, 0); assert.equal(error.message, "PET_SERVICIOS_API_ERROR"); return true;
  });
  mockFetch(t, async () => json({ error: "PRIVATE" }, 403));
  await assert.rejects(petServiciosService.getPetServicios(), { status: 403, message: "PET_SERVICIOS_API_ERROR" });
  mockFetch(t, async () => json({ error: "PRIVATE" }, 401));
  await assert.rejects(petServiciosService.getPetServicios(), { status: 401 });
  assert.equal(storage.has("token"), false); assert.equal(window.location.href, "/login");
});

test("validación local trim 1–100, con nombres duplicados sin regla de unicidad", () => {
  assert.equal(validatePetServicioNombre("  "), "Ingresá el nombre del servicio.");
  assert.equal(validatePetServicioNombre("x".repeat(101)), "Usá hasta 100 caracteres.");
  assert.equal(validatePetServicioNombre("  Baño  "), null);
  assert.equal(validatePetServicioNombre("Baño"), null);
});

test("estados de catálogo distinguen loading/error/empty/list y evitan vacío durante carga", () => {
  assert.equal(petServiciosCatalogState({ isLoading: true, isError: false, data: undefined }), "loading");
  assert.equal(petServiciosCatalogState({ isLoading: false, isError: true, data: undefined }), "error");
  assert.equal(petServiciosCatalogState({ isLoading: false, isError: false, data: [] }), "empty");
  assert.equal(petServiciosCatalogState({ isLoading: false, isError: false, data: [dto(1, "Baño")] }), "list");
});

test("estado y error visual: activos/inactivos tienen label/acción, y errores HTTP muestran copy útil", () => {
  assert.deepEqual(petServicioStatus(1), { label: "Activo", action: "Desactivar" });
  assert.deepEqual(petServicioStatus(0), { label: "Inactivo", action: "Activar" });
  assert.match(petServiciosErrorMessage(new PetServiciosApiError(400)), /nombre/);
  assert.match(petServiciosErrorMessage(new PetServiciosApiError(401)), /sesión/);
  assert.match(petServiciosErrorMessage(new PetServiciosApiError(403)), /permisos/);
  assert.match(petServiciosErrorMessage(new PetServiciosApiError(404)), /no está disponible/);
  assert.match(petServiciosErrorMessage(new PetServiciosApiError(500)), /Intentá nuevamente/);
});

test("API layer solo expone GET/POST/PATCH; no existe hard delete en este catálogo", () => {
  assert.deepEqual(Object.keys(petServiciosService).sort(), ["createPetServicio", "getPetServicios", "updatePetServicio"]);
});

test("queries/mutations no reintentan automáticamente; incertidumbre separa status conocido", async t => {
  assert.equal(petServiciosQuery("L").retry, false);
  assert.equal(petServicioMutationPolicy().retry, false);
  assert.equal(petServicioWriteIsUncertain(new PetServiciosApiError(0)), true);
  assert.equal(petServicioWriteIsUncertain(new PetServiciosApiError(500)), true);
  assert.equal(petServicioWriteIsUncertain(new PetServiciosApiError(201)), true);
  for (const status of [400, 401, 403, 404, 409]) assert.equal(petServicioWriteIsUncertain(new PetServiciosApiError(status)), false);

  const client = new QueryClient(); t.after(() => client.clear()); let writes = 0;
  const mutation = new MutationObserver(client, {
    mutationFn: async () => { writes++; throw new PetServiciosApiError(0); },
    ...petServicioMutationPolicy(),
  });
  await assert.rejects(mutation.mutate(undefined));
  assert.equal(writes, 1);
});

test("POST incierto: una sola escritura, GET autoritativo y draft disponible para revisión", async t => {
  const client = new QueryClient(); t.after(() => client.clear());
  const key = petServiciosQuery("LOCAL").queryKey;
  const authoritative = [dto(20, "Baño"), dto(21, "Baño")];
  let writes = 0; let gets = 0; const draft = "  Baño  ";
  mockFetch(t, async (_url, init) => {
    if (init.method === "POST") { writes++; return json({ error: "temporary" }, 500); }
    gets++; return json(authoritative);
  });
  const result = await petServicioWriteWithRecovery(
    () => petServiciosService.createPetServicio({ nombre: draft }),
    async () => { const data = await petServiciosService.getPetServicios(); client.setQueryData(key, data); return true; },
  );
  assert.equal(result.kind, "uncertain"); assert.equal(result.refreshed, true);
  assert.equal(writes, 1); assert.equal(gets, 1); assert.equal(draft, "  Baño  ");
  assert.deepEqual(client.getQueryData(key), authoritative);
});

test("PATCH incierto: GET reconcilia el catálogo con estado y nombre autoritativos, sin replay", async t => {
  const client = new QueryClient(); t.after(() => client.clear());
  const key = petServiciosQuery("LOCAL").queryKey;
  client.setQueryData(key, [dto(12, "Nombre anterior", 1)]);
  const authoritative = [dto(12, "Nombre remoto", 0)];
  let writes = 0; let gets = 0;
  mockFetch(t, async (_url, init) => {
    if (init.method === "PATCH") { writes++; return json({ error: "temporary" }, 500); }
    gets++; return json(authoritative);
  });
  const result = await petServicioWriteWithRecovery(
    () => petServiciosService.updatePetServicio(12, { nombre: "Draft local" }),
    async () => { const data = await petServiciosService.getPetServicios(); client.setQueryData(key, data); return true; },
  );
  assert.equal(result.kind, "uncertain"); assert.equal(result.refreshed, true);
  assert.equal(writes, 1); assert.equal(gets, 1);
  assert.deepEqual(client.getQueryData(key), authoritative);
});

test("PATCH 404 también refresca y clasifica recurso ausente; error conocido no refetchea", async t => {
  let gets = 0; mockFetch(t, async (_url, init) => init.method === "PATCH"
    ? json({ error: "not found" }, 404) : (gets++, json([])));
  const missing = await petServicioWriteWithRecovery(
    () => petServiciosService.updatePetServicio(12, { activo: false }),
    async () => { await petServiciosService.getPetServicios(); return true; },
  );
  assert.equal(missing.kind, "not-found"); assert.equal(missing.refreshed, true); assert.equal(gets, 1);

  const known = await petServicioWriteWithRecovery(
    () => petServiciosService.updatePetServicio(0, { activo: false }),
    async () => { gets++; return true; },
  );
  assert.equal(known.kind, "known-error"); assert.equal(gets, 1);
});
