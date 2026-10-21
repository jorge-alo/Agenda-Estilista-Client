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

const { petHorariosService, PetHorariosApiError } = await import("../src/feature/admin/petHorarios/services/petHorarios.service.ts");
const { petHorarioMutationPolicy, petHorarioWriteIsUncertain, petHorarioWriteWithRecovery, petHorariosQuery, invalidatePetHorarioDependencies } = await import("../src/feature/admin/petHorarios/queries/petHorariosQueries.ts");
const { PET_DAYS, normalizePetTime, petHorarioPatch, validatePetHorarioDraft } = await import("../src/feature/admin/petHorarios/types/petHorarios.types.ts");
const { petHorarioChangeApplied, petHorarioDayState, petHorarioTimeLabel, petHorariosErrorMessage } = await import("../src/feature/admin/petHorarios/components/petHorariosView.ts");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const row = (id: number, day = 1, start = "09:00:00", end = "13:00:00", active = 1) => ({ id, dia_semana: day, hora_inicio: start, hora_fin: end, activo: active });
function mockFetch(t: TestContext, fn: (url: string, init: RequestInit) => Promise<Response>) {
  storage.set("token", "PET_HORARIOS_TEST"); window.location.href = "";
  t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, init?: RequestInit) => fn(String(url), init ?? {}));
}

test("GET usa catálogo PET auth, acepta DTO contractual incluyendo inactivos y devuelve vacío", async t => {
  let value: unknown = [row(1), row(2, 1, "15:00:00", "19:00:00"), row(3, 2, "10:00:00", "12:00:00", 0)];
  mockFetch(t, async (url, init) => {
    assert.equal(url, "/api/pet/admin/horarios"); assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer PET_HORARIOS_TEST"); return json(value);
  });
  assert.deepEqual(await petHorariosService.get(), value);
  value = []; assert.deepEqual(await petHorariosService.get(), []);
  value = [{ ...row(1), local_id: 9, extra: true }]; assert.deepEqual(await petHorariosService.get(), [row(1)]);
  value = [row(1, 9)]; await assert.rejects(petHorariosService.get(), { status: 200 });
});

test("semana deriva sete dias, vários tramos, Cerrado e estados operativos de activos/inactivos", () => {
  assert.deepEqual(PET_DAYS.map(day => day.id), [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(petHorarioDayState([row(1), row(2, 1, "15:00:00", "19:00:00")]), "open");
  assert.equal(petHorarioDayState([row(3, 2, "10:00:00", "12:00:00", 0)]), "closed");
  assert.equal(petHorarioDayState([]), "closed");
  assert.equal(petHorarioTimeLabel("09:00:00", "13:00:00"), "09:00 – 13:00");
  assert.equal(normalizePetTime("09:00:00"), "09:00");
});

test("reconciliación solo adopta una creación activa inequívoca, PATCH esperado o DELETE ausente", () => {
  assert.equal(petHorarioChangeApplied([row(1)], { kind: "create", expected: { diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" } }), true);
  assert.equal(petHorarioChangeApplied([row(1, 1, "09:00:00", "13:00:00", 0)], { kind: "create", expected: { diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" } }), false);
  assert.equal(petHorarioChangeApplied([row(1, 2)], { kind: "update", id: 1, expected: { diaSemana: 2 } }), true);
  assert.equal(petHorarioChangeApplied([], { kind: "delete", id: 1 }), true);
  assert.equal(petHorarioChangeApplied([row(1)], { kind: "delete", id: 1 }), false);
});

test("POST envía solo día y HH:mm, sin activo; valida los datos locales sin inventar unicidad", async t => {
  const payloads: unknown[] = []; mockFetch(t, async (_url, init) => { payloads.push(JSON.parse(String(init.body))); return json(row(4, 1, "09:00:00", "13:00:00"), 201); });
  assert.deepEqual(await petHorariosService.create({ diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" }), row(4, 1, "09:00:00", "13:00:00"));
  assert.deepEqual(payloads, [{ diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" }]);
  assert.equal(validatePetHorarioDraft({ diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" }), null);
  assert.equal(validatePetHorarioDraft({ diaSemana: 7, horaInicio: "09:00", horaFin: "13:00" }), "Elegí un día válido.");
  assert.match(validatePetHorarioDraft({ diaSemana: 1, horaInicio: "", horaFin: "13:00" }) ?? "", /hora válida/);
  assert.match(validatePetHorarioDraft({ diaSemana: 1, horaInicio: "13:00", horaFin: "13:00" }) ?? "", /anterior/);
  assert.match(validatePetHorarioDraft({ diaSemana: 1, horaInicio: "22:00", horaFin: "02:00" }) ?? "", /anterior/);
  assert.equal(validatePetHorarioDraft({ diaSemana: 1, horaInicio: "09:00:00", horaFin: "13:00:00" }), null);
});

test("PATCH usa los campos realmente cambiados; no-op detectado y estado es booleano", async t => {
  const original = row(8); const bodies: unknown[] = [];
  mockFetch(t, async (_url, init) => { const body = JSON.parse(String(init.body)); bodies.push(body); return json({ ...original, ...("activo" in body ? { activo: body.activo ? 1 : 0 } : {}) }); });
  assert.deepEqual(petHorarioPatch(original, { diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" }), {});
  assert.deepEqual(petHorarioPatch(original, { diaSemana: 2, horaInicio: "09:00", horaFin: "13:00" }), { diaSemana: 2 });
  await petHorariosService.update(8, { diaSemana: 2 }); await petHorariosService.update(8, { activo: false }); await petHorariosService.update(8, { activo: true });
  assert.deepEqual(bodies, [{ diaSemana: 2 }, { activo: false }, { activo: true }]);
  await assert.rejects(petHorariosService.update(8, {}), { status: 400 });
});

test("DELETE usa hard delete y requiere 204", async t => {
  let status = 204; let method = "";
  mockFetch(t, async (url, init) => { assert.equal(url, "/api/pet/admin/horarios/7"); method = String(init.method); return new Response(null, { status }); });
  await petHorariosService.remove(7); assert.equal(method, "DELETE");
  status = 200; await assert.rejects(petHorariosService.remove(7), { status: 200 });
});

test("errores 400/401/403/404/409/500 son comprensibles y 409 cubre duplicado inactivo", () => {
  for (const status of [400, 401, 403, 404, 409, 500]) assert.ok(petHorariosErrorMessage(new PetHorariosApiError(status)).length > 0);
  assert.match(petHorariosErrorMessage(new PetHorariosApiError(409)), /incluso si está inactivo/);
  assert.equal(petHorariosErrorMessage(new PetHorariosApiError(401)).includes("sesión"), true);
});

test("query key PET queda separada por local, retry false; invalidación acotada a dependencias PET", async () => {
  assert.deepEqual(petHorariosQuery("LOCAL").queryKey, ["pet-horarios", "LOCAL"]);
  assert.equal(petHorariosQuery("LOCAL").retry, false); assert.deepEqual(petHorariosQuery("OTRO").queryKey, ["pet-horarios", "OTRO"]);
  const keys: readonly unknown[][] = [];
  await invalidatePetHorarioDependencies({ invalidateQueries: async ({ queryKey }) => { (keys as unknown as unknown[][]).push(queryKey); } }, "LOCAL");
  assert.deepEqual(keys, [["pet-horarios", "LOCAL"], ["pet-admin-booking", "availability"], ["pet-turno-disponibilidad"]]);
});

test("todas las escrituras retry:false y POST incierto reconcilia por GET sin replay", async t => {
  assert.equal(petHorarioMutationPolicy().retry, false);
  for (const status of [0, 500, 201]) assert.equal(petHorarioWriteIsUncertain(new PetHorariosApiError(status)), true);
  for (const status of [400, 401, 403, 404, 409]) assert.equal(petHorarioWriteIsUncertain(new PetHorariosApiError(status)), false);
  const client = new QueryClient(); t.after(() => client.clear()); let writes = 0; let reads = 0;
  const key = petHorariosQuery("LOCAL").queryKey;
  mockFetch(t, async (_url, init) => { if (init.method === "POST") { writes++; return json({ error: "unknown" }, 500); } reads++; return json([row(88)]); });
  const result = await petHorarioWriteWithRecovery(() => petHorariosService.create({ diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" }), async () => {
    const data = await petHorariosService.get(); client.setQueryData(key, data); return true;
  });
  assert.equal(result.kind, "uncertain"); assert.equal(result.refreshed, true); assert.equal(writes, 1); assert.equal(reads, 1);
  assert.deepEqual(client.getQueryData(key), [row(88)]);
});

test("PATCH/DELETE 404 reconcilian; error conocido no es replay", async t => {
  let calls = 0; mockFetch(t, async (_url, init) => { calls++; return init.method === "GET" ? json([]) : json({ error: "missing" }, 404); });
  const result = await petHorarioWriteWithRecovery(() => petHorariosService.update(3, { activo: false }), async () => { await petHorariosService.get(); return true; });
  assert.equal(result.kind, "not-found"); assert.equal(result.refreshed, true); assert.equal(calls, 2);
  const client = new QueryClient(); t.after(() => client.clear());
  const unrelatedKey = ["turnos"] as const; client.setQueryData(unrelatedKey, ["untouched"]);
  await invalidatePetHorarioDependencies(client, "LOCAL");
  assert.deepEqual(client.getQueryData(unrelatedKey), ["untouched"]);
});
