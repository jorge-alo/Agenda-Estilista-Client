import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { registerHooks } from "node:module";
import { QueryClient } from "@tanstack/react-query";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json)$/.test(specifier)) {
    try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(specifier); }
  }
  return nextResolve(specifier);
} });

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => storage.delete(key) } });
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "" } } });

const { petBloqueosService, PetBloqueosApiError } = await import("../src/feature/admin/petBloqueos/services/petBloqueos.service.ts");
const { petBloqueosQuery, petBloqueoMutationPolicy, petBloqueoChangeApplied, petBloqueoWriteIsUncertain, invalidatePetBloqueoDependencies, acquirePetBloqueoWriteLock } = await import("../src/feature/admin/petBloqueos/queries/petBloqueosQueries.ts");
const { petBloqueoFechaValida, validatePetBloqueoDraft, petBloqueoPayload, petBloqueoPatch, petBloqueoPayloadMatches } = await import("../src/feature/admin/petBloqueos/types/petBloqueos.types.ts");
const { petBloqueosErrorMessage } = await import("../src/feature/admin/petBloqueos/components/petBloqueosView.ts");
const { getPetAdminContentKind } = await import("../src/feature/admin/pages/adminPage/petAdminContent.ts");
const full = (id: number, fecha = "2026-10-22", motivo: string | null = "Feriado") => ({ id, fecha, hora_inicio: null, hora_fin: null, motivo, es_dia_completo: 1 as const });
const partial = (id: number, fecha = "2026-10-24", start = "14:00:00", end = "16:00:00", motivo: string | null = "Turno médico") => ({ id, fecha, hora_inicio: start, hora_fin: end, motivo, es_dia_completo: 0 as const });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_BLOQUEOS_TEST"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}

test("GET usa endpoint PET autenticado, orden backend, DTO estricto y empty", async t => {
  let body: unknown = [full(1), partial(2), partial(3, "2026-10-25", "09:00:00", "10:00:00", null)];
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/bloqueos"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer PET_BLOQUEOS_TEST"); return json(body);
  });
  assert.deepEqual(await petBloqueosService.get(), body);
  body = []; assert.deepEqual(await petBloqueosService.get(), []);
  body = [{ ...full(1), motivo: null, local_id: 4 }]; assert.deepEqual(await petBloqueosService.get(), [full(1, "2026-10-22", null)]);
  body = [{ ...full(1), hora_inicio: "09:00:00" }]; await assert.rejects(petBloqueosService.get(), { status: 200 });
});

test("fecha calendario real valida bisiestos y rechaza rangos/formato inválidos", () => {
  assert.equal(petBloqueoFechaValida("2024-02-29"), true);
  for (const date of ["2026-02-29", "2026-13-01", "2026-04-31", "0999-12-31", "2026-1-01", "2026-10-22T00:00:00"]) assert.equal(petBloqueoFechaValida(date), false);
  assert.deepEqual(validatePetBloqueoDraft({ fecha: "2026-02-30", esDiaCompleto: true, horaInicio: "", horaFin: "", motivo: "" }).fecha, "Ingresá una fecha calendario válida.");
});

test("día completo omite horas; parcial exige HH:mm, inicio anterior y sin cruce medianoche", () => {
  const whole = { fecha: "2026-10-22", esDiaCompleto: true, horaInicio: "", horaFin: "", motivo: " Feriado " };
  assert.deepEqual(validatePetBloqueoDraft(whole), {});
  assert.deepEqual(petBloqueoPayload(whole), { fecha: "2026-10-22", esDiaCompleto: true, motivo: "Feriado" });
  const partialDraft = { fecha: "2026-10-24", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: "" };
  assert.deepEqual(validatePetBloqueoDraft(partialDraft), {});
  assert.deepEqual(petBloqueoPayload(partialDraft), { fecha: "2026-10-24", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: null });
  for (const [start, end] of [["", "16:00"], ["14:00", ""], ["16:00", "14:00"], ["22:00", "02:00"], ["24:00", "25:00"]]) {
    assert.ok(Object.keys(validatePetBloqueoDraft({ ...partialDraft, horaInicio: start, horaFin: end })).length > 0);
  }
  assert.match(validatePetBloqueoDraft({ ...whole, motivo: "x".repeat(256) }).motivo ?? "", /255/);
});

test("POST completo y parcial envía payload contractual y requiere 201", async t => {
  const bodies: unknown[] = []; let response: Response = json(full(4), 201);
  mockFetch(t, async (url, init) => { assert.equal(url, "/api/pet/admin/bloqueos"); assert.equal(init.method, "POST"); bodies.push(JSON.parse(String(init.body))); return response; });
  const whole = { fecha: "2026-10-22", esDiaCompleto: true, horaInicio: "", horaFin: "", motivo: "Feriado" };
  await petBloqueosService.create(petBloqueoPayload(whole));
  response = json(partial(5), 201);
  await petBloqueosService.create(petBloqueoPayload({ fecha: "2026-10-24", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: "Turno médico" }));
  assert.deepEqual(bodies, [
    { fecha: "2026-10-22", esDiaCompleto: true, motivo: "Feriado" },
    { fecha: "2026-10-24", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: "Turno médico" },
  ]);
  response = json(full(4), 200); await assert.rejects(petBloqueosService.create({ fecha: "2026-10-22", esDiaCompleto: true }), { status: 200 });
});

test("PATCH transiciones completo↔parcial incluye campos para limpiar o establecer ambas horas", async t => {
  const bodies: unknown[] = []; mockFetch(t, async (_url, init) => {
    assert.equal(init.method, "PATCH"); bodies.push(JSON.parse(String(init.body)));
    const body = bodies.at(-1) as Record<string, unknown>;
    return json(body.esDiaCompleto === true ? full(7) : partial(7, "2026-10-22"));
  });
  const totalDraft = { fecha: "2026-10-22", esDiaCompleto: true, horaInicio: "", horaFin: "", motivo: "" };
  const toFull = petBloqueoPatch(totalDraft); await petBloqueosService.update(7, toFull);
  assert.deepEqual(toFull, { fecha: "2026-10-22", esDiaCompleto: true, motivo: null });
  const partDraft = { fecha: "2026-10-22", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: "" };
  const toPartial = petBloqueoPatch(partDraft); await petBloqueosService.update(7, toPartial);
  assert.deepEqual(toPartial, { fecha: "2026-10-22", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: null });
  assert.deepEqual(bodies, [toFull, toPartial]);
});

test("DELETE espera hard delete 204; 404 se distingue", async t => {
  let status = 204; mockFetch(t, async (_url, init) => { assert.equal(init.method, "DELETE"); return new Response(null, { status }); });
  await petBloqueosService.remove(8); status = 404;
  await assert.rejects(petBloqueosService.remove(8), { status: 404 });
});

test("lock síncrono admite el primer submit y bloquea el segundo antes del siguiente render", () => {
  const lock = { current: false };
  assert.equal(acquirePetBloqueoWriteLock(lock), true);
  assert.equal(acquirePetBloqueoWriteLock(lock), false);
  lock.current = false;
  assert.equal(acquirePetBloqueoWriteLock(lock), true);
});

test("errores incluidos 409 se muestran claramente; query PET propia e invalidaciones acotadas", async () => {
  assert.match(petBloqueosErrorMessage(new PetBloqueosApiError(409)), /Bloqueo solapado/);
  for (const status of [400, 401, 403, 404, 500]) assert.ok(petBloqueosErrorMessage(new PetBloqueosApiError(status)).length > 0);
  assert.deepEqual(petBloqueosQuery("LOCAL").queryKey, ["pet-bloqueos", "LOCAL"]);
  assert.deepEqual(petBloqueosQuery("OTRO").queryKey, ["pet-bloqueos", "OTRO"]);
  assert.equal(petBloqueosQuery("LOCAL").retry, false); assert.equal(petBloqueoMutationPolicy().retry, false);
  const keys: readonly unknown[][] = [];
  await invalidatePetBloqueoDependencies({ invalidateQueries: async ({ queryKey }) => { (keys as unknown as unknown[][]).push(queryKey); } }, "LOCAL");
  assert.deepEqual(keys, [["pet-bloqueos", "LOCAL"], ["pet-admin-booking", "availability"], ["pet-turno-disponibilidad"]]);
});

test("reconciliación por GET adopta solo estado confirmable y nunca reenvía escrituras", async t => {
  const client = new QueryClient(); t.after(() => client.clear()); let writes = 0; let reads = 0; const records: unknown = [partial(19)];
  mockFetch(t, async (_url, init) => {
    if (init.method === "POST") { writes++; return json({ error: "unknown" }, 500); }
    reads++; return json(records);
  });
  const expected = { fecha: "2026-10-24", esDiaCompleto: false, horaInicio: "14:00", horaFin: "16:00", motivo: "Turno médico" };
  const pending = { kind: "create" as const, expected, previousIds: [] };
  assert.equal(petBloqueoWriteIsUncertain(new PetBloqueosApiError(500)), true);
  assert.equal(petBloqueoWriteIsUncertain(new PetBloqueosApiError(409)), false);
  await assert.rejects(petBloqueosService.create(expected), { status: 500 });
  const observed = await petBloqueosService.get(); assert.equal(petBloqueoChangeApplied(observed, pending), true);
  assert.equal(writes, 1); assert.equal(reads, 1);
  assert.equal(petBloqueoChangeApplied([partial(19, "2026-10-24", "14:00:00", "16:00:00", "otro")], pending), false);
  assert.equal(petBloqueoPayloadMatches(full(1), { esDiaCompleto: true, horaInicio: null, horaFin: null }), true);
  assert.equal(petBloqueoChangeApplied([], { kind: "delete", id: 19 }), true);
  assert.equal(petBloqueoChangeApplied([partial(19)], { kind: "delete", id: 19 }), false);
  client.setQueryData(petBloqueosQuery("LOCAL").queryKey, observed);
});

test("shell PET dirige Bloqueos a UI real y mantiene Configuración placeholder", () => {
  assert.equal(getPetAdminContentKind("horarios"), "horarios");
  assert.equal(getPetAdminContentKind("bloqueos"), "bloqueos");
  assert.equal(getPetAdminContentKind("configuracion"), "placeholder");
});
