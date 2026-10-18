import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { parseMagicLinkFragment, removeMagicLinkFragment } from "../src/feature/publicPet/session/magicLinkFragment.ts";
import {
  parseStoredPetSession,
  petSessionStorageKey,
  readPetSession,
  removePetSession,
  writePetSession,
  type StoredPetSession,
} from "../src/feature/publicPet/session/petSessionStorage.ts";
import { runOnceByKey } from "../src/feature/publicPet/session/singleFlight.ts";
import {
  canStartPetLogout,
  getPetLandingMode,
  petAccessRedirectPath,
  PET_SESSION_EXPIRED_MESSAGE,
  runPetRequestOnce,
} from "../src/feature/publicPet/session/publicPetRequestUi.ts";
import {
  activatePetSessionScope,
  clearPetSessionScope,
  currentPetSessionScope,
  invalidateCurrentPetSession,
  isCurrentPetSessionScope,
  releasePetSessionScope,
} from "../src/feature/publicPet/session/petSessionScope.ts";
import { petSessionUiStateAfterRefresh, type PetSessionUiState } from "../src/feature/publicPet/session/petSessionUiState.ts";
import {
  consumePetMagicLinkOnce,
  logoutPetSession,
  PetSessionApiError,
  petAccessRequestErrorMessage,
  PET_ACCESS_REQUEST_SUCCESS_MESSAGE,
  refreshPetSessionProfileOnce,
  requestPetAccessLink,
  restorePetSessionOnce,
  validatePetAccessPhone,
} from "../src/feature/publicPet/session/publicPetSession.service.ts";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  value(key: string) { return this.values.get(key) ?? null; }
}

const token = () => randomBytes(32).toString("base64url");
const futureSession = (): StoredPetSession => ({
  token: token(),
  expiresAt: "2099-01-02T03:04:05.678Z",
});

test("magic link: acepta solo #token canónico y no acepta query param como fallback", () => {
  const secret = token();
  assert.deepEqual(parseMagicLinkFragment(`#token=${secret}`), { kind: "token", token: secret });
  assert.deepEqual(parseMagicLinkFragment(""), { kind: "none" });
  for (const invalid of [
    `?token=${secret}`,
    `#other=${secret}`,
    `#token=${secret}&token=${secret}`,
    `#token=${secret}&extra=1`,
    "#token=not-a-token",
    `#token=${secret}=`,
    `#token=${secret.slice(0, -1)}+`,
  ]) assert.deepEqual(parseMagicLinkFragment(invalid), { kind: "invalid" });
});

test("magic link: retira el fragment inmediatamente y preserva solo el path", () => {
  const calls: unknown[][] = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      history: { state: { router: "state" }, replaceState: (...args: unknown[]) => calls.push(args) },
      location: { pathname: "/local/acceso", search: "?tracking=1", hash: `#token=${token()}` },
    },
  });
  try {
    removeMagicLinkFragment();
    assert.deepEqual(calls, [[{ router: "state" }, "", "/local/acceso"]]);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete (globalThis as { window?: unknown }).window;
  }
});

test("sessionStorage: namespace aislado por slug y persiste exclusivamente token + expiresAt", () => {
  const storage = new MemoryStorage();
  const a = futureSession();
  const b = futureSession();
  const keyA = petSessionStorageKey("local-a");
  const keyB = petSessionStorageKey("local-b");
  assert.notEqual(keyA, keyB);
  assert.equal(writePetSession("local-a", a, storage), true);
  assert.equal(writePetSession("local-b", b, storage), true);
  assert.deepEqual(readPetSession("local-a", Date.now(), storage), a);
  assert.deepEqual(readPetSession("local-b", Date.now(), storage), b);
  const persisted = JSON.parse(storage.value(keyA));
  assert.deepEqual(Object.keys(persisted).sort(), ["expiresAt", "token"]);
  assert.ok(!storage.value(keyA).includes("challenge"));
  removePetSession("local-a", storage);
  assert.equal(storage.getItem(keyB) !== null, true);
});

test("sessionStorage: valida estructura, canonicalidad y elimina expiradas o corruptas solo para el slug", () => {
  const now = Date.parse("2030-01-01T00:00:00.000Z");
  const valid = { token: token(), expiresAt: "2030-01-01T00:00:01.000Z" };
  assert.deepEqual(parseStoredPetSession(JSON.stringify(valid), now), valid);
  const invalid: unknown[] = [
    null,
    { token: valid.token, expiresAt: "not a date" },
    { token: valid.token, expiresAt: "2029-12-31T23:59:59.999Z" },
    { token: "bad", expiresAt: valid.expiresAt },
    { token: valid.token, expiresAt: valid.expiresAt, clienteId: 1 },
  ];
  for (const item of invalid) assert.equal(parseStoredPetSession(JSON.stringify(item), now), null);
  assert.equal(parseStoredPetSession("{", now), null);

  const a = petSessionStorageKey("local-a");
  const b = petSessionStorageKey("local-b");
  const storage = new MemoryStorage();
  storage.setItem(a, JSON.stringify({ token: valid.token, expiresAt: "2029-12-31T23:59:59.999Z" }));
  storage.setItem(b, JSON.stringify(valid));
  assert.equal(readPetSession("local-a", now, storage), null);
  assert.equal(storage.getItem(a), null, "la key vencida del slug se elimina");
  assert.ok(storage.getItem(b));
});

test("StrictMode helper: dos ejecuciones simultáneas comparten una sola operación y luego liberan la clave", async () => {
  const flights = new Map<string, Promise<number>>();
  let calls = 0;
  let release!: (value: number) => void;
  const operation = () => {
    calls++;
    return new Promise<number>(resolve => { release = resolve; });
  };
  const first = runOnceByKey(flights, "local-a", operation);
  const second = runOnceByKey(flights, "local-a", operation);
  assert.equal(first, second);
  assert.equal(calls, 0, "operation starts after the map is populated");
  await Promise.resolve();
  assert.equal(calls, 1);
  release(42);
  assert.equal(await first, 42);
  assert.equal(await second, 42);
  await Promise.resolve();
  assert.equal(flights.has("local-a"), false);
});

function withTestStorage<T>(storage: MemoryStorage, run: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: storage } });
  return run().finally(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete (globalThis as { window?: unknown }).window;
  });
}

test("consume: un solo request bajo doble ejecución, guarda solo sesión por slug y luego pide /me Bearer", async t => {
  const storage = new MemoryStorage();
  const challenge = token();
  const session = futureSession();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/session/consume")) {
      return new Response(JSON.stringify({ sessionToken: session.token, expiresAt: session.expiresAt }), { status: 201 });
    }
    return new Response(JSON.stringify({ cliente: { nombre: "Ana" }, mascotas: [{ id: 9, nombre: "Rocky" }] }), { status: 200 });
  });

  await withTestStorage(storage, async () => {
    const first = consumePetMagicLinkOnce("local-a", challenge);
    const strictReplay = consumePetMagicLinkOnce("local-a", challenge);
    assert.equal(first, strictReplay);
    const [a, b] = await Promise.all([first, strictReplay]);
    assert.deepEqual(a, b);
    assert.ok(a.status === "authenticated");
    assert.equal(calls.length, 2, "exactamente un consume y un /me");
    assert.equal(calls[0].url, "/api/pet/public/local-a/session/consume");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { token: challenge });
    assert.deepEqual(calls[0].init?.headers, { "Content-Type": "application/json" });
    assert.deepEqual(calls[1].init?.headers, { Authorization: `Bearer ${session.token}` });
    assert.equal(storage.getItem(petSessionStorageKey("local-a")), JSON.stringify(session));
    assert.equal(storage.getItem(petSessionStorageKey("local-b")), null);
    assert.ok(!storage.value(petSessionStorageKey("local-a")).includes(challenge));
  });
});

test("restauración: consulta /me y un 401 limpia solo la key del slug actual", async t => {
  const storage = new MemoryStorage();
  const current = futureSession();
  const other = futureSession();
  storage.setItem(petSessionStorageKey("local-a"), JSON.stringify(current));
  storage.setItem(petSessionStorageKey("local-b"), JSON.stringify(other));
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.ok(String(input).endsWith("/local-a/session/me"));
    assert.deepEqual(init?.headers, { Authorization: `Bearer ${current.token}` });
    return new Response(JSON.stringify({ error: "PET_SESSION_INVALID" }), { status: 401 });
  });
  await withTestStorage(storage, async () => {
    assert.deepEqual(await restorePetSessionOnce("local-a"), { status: "unauthenticated" });
    assert.equal(calls, 1);
    assert.equal(storage.getItem(petSessionStorageKey("local-a")), null);
    assert.notEqual(storage.getItem(petSessionStorageKey("local-b")), null);
  });
});

test("restauración: sesión vigente consulta /me y vuelve a estado autenticado", async t => {
  const storage = new MemoryStorage();
  const session = futureSession();
  storage.setItem(petSessionStorageKey("local-a"), JSON.stringify(session));
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.ok(String(input).endsWith("/local-a/session/me"));
    assert.deepEqual(init?.headers, { Authorization: `Bearer ${session.token}` });
    return new Response(JSON.stringify({ cliente: { nombre: "Ana" }, mascotas: [] }), { status: 200 });
  });
  await withTestStorage(storage, async () => {
    const result = await restorePetSessionOnce("local-a");
    assert.equal(result.status, "authenticated");
    if (result.status === "authenticated") {
      assert.equal(result.profile.cliente.nombre, "Ana");
      assert.deepEqual(result.profile.mascotas, []);
    }
    assert.equal(calls, 1);
    assert.notEqual(storage.getItem(petSessionStorageKey("local-a")), null);
  });
});

test("logout: una falla de red elimina de todos modos la sesión solo para ese slug", async t => {
  const storage = new MemoryStorage();
  const current = futureSession();
  const other = futureSession();
  storage.setItem(petSessionStorageKey("local-a"), JSON.stringify(current));
  storage.setItem(petSessionStorageKey("local-b"), JSON.stringify(other));
  let request: { url: string; init?: RequestInit } | undefined;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(input), init };
    throw new Error("network failure sentinel");
  });
  await withTestStorage(storage, async () => {
    await assert.rejects(logoutPetSession("local-a", current.token));
    assert.equal(storage.getItem(petSessionStorageKey("local-a")), null);
    assert.notEqual(storage.getItem(petSessionStorageKey("local-b")), null);
  });
  assert.equal(request?.url, "/api/pet/public/local-a/session/logout");
  assert.deepEqual(request?.init?.headers, { Authorization: `Bearer ${current.token}` });
});

test("logout: respuesta 204 elimina storage del slug y mantiene aisladas otras sesiones", async t => {
  const storage = new MemoryStorage();
  const current = futureSession();
  const other = futureSession();
  storage.setItem(petSessionStorageKey("local-a"), JSON.stringify(current));
  storage.setItem(petSessionStorageKey("local-b"), JSON.stringify(other));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "/api/pet/public/local-a/session/logout");
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { Authorization: `Bearer ${current.token}` });
    return new Response(null, { status: 204 });
  });
  await withTestStorage(storage, async () => {
    await logoutPetSession("local-a", current.token);
    assert.equal(storage.getItem(petSessionStorageKey("local-a")), null);
    assert.notEqual(storage.getItem(petSessionStorageKey("local-b")), null);
  });
});

test("request de acceso: valida solo forma básica y conserva teléfonos sin canonicalizar", () => {
  assert.equal(validatePetAccessPhone(""), "required");
  assert.equal(validatePetAccessPhone("   "), "required");
  assert.equal(validatePetAccessPhone("1".repeat(51)), "too-long");
  assert.equal(validatePetAccessPhone("texto no canonicalizable"), null, "el backend decide canonicalización");
  assert.equal(validatePetAccessPhone(" 011 15 1234-5678 "), null);
});

test("landing PET: sesión autenticada reemplaza los formularios; no autenticada conserva primera visita y Ya soy cliente", () => {
  assert.equal(getPetLandingMode("authenticated"), "authenticated");
  assert.equal(getPetLandingMode("loading"), "loading");
  assert.equal(getPetLandingMode("logging-out"), "loading");
  assert.equal(getPetLandingMode("error"), "error");
  assert.equal(getPetLandingMode("unauthenticated"), "first-visit");
  assert.equal(getPetLandingMode("invalid-link"), "first-visit");
});

test("request de acceso: doble submit mientras pending ejecuta solo una operación", async () => {
  const gate = { current: false };
  let calls = 0;
  let release!: () => void;
  const operation = () => {
    calls++;
    return new Promise<void>(resolve => { release = resolve; });
  };
  const first = runPetRequestOnce(gate, operation);
  const second = await runPetRequestOnce(gate, operation);
  assert.equal(second, false);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, true);
  assert.equal(gate.current, false);
});

test("request de acceso: slug correcto, body exacto solo telefono, sin Bearer y 202 sin inspeccionar resultado", async t => {
  const phone = " 011 15 1234-5678 ";
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let responseBody = "";
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(responseBody, { status: 202, headers: { "Content-Type": "application/json" } });
  });
  responseBody = JSON.stringify({ ok: true });
  assert.equal(await requestPetAccessLink("local/a", phone), undefined);
  responseBody = JSON.stringify({ ok: true, sent: false, eligible: false, clienteId: 42 });
  assert.equal(await requestPetAccessLink("local/a", phone), undefined);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, "/api/pet/public/local%2Fa/session/request");
    assert.equal(request.init?.method, "POST");
    assert.deepEqual(request.init?.headers, { "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(String(request.init?.body)), { telefono: phone });
    assert.equal(request.init?.cache, "no-store");
  }
  assert.equal(PET_ACCESS_REQUEST_SUCCESS_MESSAGE,
    "Si encontramos una cuenta habilitada con ese número, te enviamos un enlace por WhatsApp.");
});

test("request de acceso: 429, 404, 500 y red solo producen errores genéricos", async t => {
  const statuses = [429, 404, 500];
  for (const status of statuses) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
      error: status === 404 ? "PET_LOCAL_NOT_FOUND" : "SECRET_RESPONSE_SENTINEL",
      telefono: "SECRET_PHONE_SENTINEL",
    }), { status }));
    let error: unknown;
    try { await requestPetAccessLink("local", "1123456789"); } catch (caught) { error = caught; }
    assert.ok(error instanceof PetSessionApiError);
    assert.equal(petAccessRequestErrorMessage(error), status === 429
      ? "Hay demasiados intentos. Probá nuevamente más tarde."
      : status === 404
        ? "Este local no está disponible."
        : "No pudimos procesar la solicitud en este momento. Intentá nuevamente más tarde.");
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, "fetch", async () => { throw new Error("SECRET_NETWORK_SENTINEL"); });
  let networkError: unknown;
  try { await requestPetAccessLink("local", "1123456789"); } catch (caught) { networkError = caught; }
  assert.ok(networkError instanceof PetSessionApiError);
  assert.equal(petAccessRequestErrorMessage(networkError), "No pudimos procesar la solicitud en este momento. Intentá nuevamente más tarde.");
});

test("scope: restore simultáneo comparte scope y una instancia nueva genera otro scope", async t => {
  const storage = new MemoryStorage();
  const session = futureSession();
  storage.setItem(petSessionStorageKey("scope-stable"), JSON.stringify(session));
  let meCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    meCalls++;
    return new Response(JSON.stringify({ cliente: { nombre: "Ana" }, mascotas: [] }), { status: 200 });
  });
  await withTestStorage(storage, async () => {
    const first = restorePetSessionOnce("scope-stable");
    const replay = restorePetSessionOnce("scope-stable");
    assert.equal(first, replay, "StrictMode comparte el mismo flight");
    const [a, b] = await Promise.all([first, replay]);
    assert.equal(a.status, "authenticated");
    if (a.status !== "authenticated" || b.status !== "authenticated") return;
    assert.equal(a.sessionScope, b.sessionScope, "la instancia restaurada mantiene su scope");
    assert.ok(!a.sessionScope.includes(session.token), "el scope no se deriva del Bearer");
    assert.equal(currentPetSessionScope("scope-stable"), a.sessionScope);

    const again = await restorePetSessionOnce("scope-stable");
    assert.equal(again.status, "authenticated");
    if (again.status !== "authenticated") return;
    assert.notEqual(again.sessionScope, a.sessionScope, "una instancia nueva no reutiliza el scope anterior");
    assert.equal(currentPetSessionScope("scope-stable"), again.sessionScope);
    assert.equal(isCurrentPetSessionScope("scope-stable", a.sessionScope), false);
    assert.equal(meCalls, 2, "un /me por flight, sin doble restore destructivo");

    const persisted = JSON.parse(storage.value(petSessionStorageKey("scope-stable")));
    assert.deepEqual(Object.keys(persisted).sort(), ["expiresAt", "token"], "el reload no restaura draft/scope persistidos");
    assert.equal(storage.length, 1);
  });
  clearPetSessionScope("scope-stable");
});

test("scope: consume no deriva del challenge ni del token y no se persiste", async t => {
  const storage = new MemoryStorage();
  const challenge = token();
  const session = futureSession();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/session/consume")) {
      return new Response(JSON.stringify({ sessionToken: session.token, expiresAt: session.expiresAt }), { status: 201 });
    }
    return new Response(JSON.stringify({ cliente: { nombre: "Ana" }, mascotas: [] }), { status: 200 });
  });
  await withTestStorage(storage, async () => {
    const result = await consumePetMagicLinkOnce("scope-consume", challenge);
    assert.equal(result.status, "authenticated");
    if (result.status !== "authenticated") return;
    assert.notEqual(result.sessionScope, result.session.token);
    assert.ok(!result.sessionScope.includes(result.session.token));
    assert.ok(!result.sessionScope.includes(challenge));
    const raw = storage.value(petSessionStorageKey("scope-consume"));
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["expiresAt", "token"]);
    assert.equal(raw.includes(result.sessionScope), false, "el scope es solo memoria");
    assert.equal(raw.includes(challenge), false);
  });
  clearPetSessionScope("scope-consume");
});

test("401 scoped: invalida solo si slug+scope siguen vigentes y nunca toca auth admin", () => {
  const storage = new MemoryStorage();
  let adminReads = 0;
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: storage,
      get localStorage() { adminReads++; throw new Error("ADMIN_STORAGE_MUST_NOT_BE_READ"); },
    },
  });
  try {
    const a = futureSession();
    const b = futureSession();
    storage.setItem(petSessionStorageKey("scope-invalid-a"), JSON.stringify(a));
    storage.setItem(petSessionStorageKey("scope-invalid-b"), JSON.stringify(b));
    activatePetSessionScope("scope-invalid-a", "scope-a-1");
    activatePetSessionScope("scope-invalid-b", "scope-b-1");

    assert.equal(invalidateCurrentPetSession("scope-invalid-a", "scope-a-1"), true);
    assert.equal(storage.getItem(petSessionStorageKey("scope-invalid-a")), null);
    assert.equal(isCurrentPetSessionScope("scope-invalid-a", "scope-a-1"), false);

    // Late 401 from the replaced instance: ignored, the new authority stays intact.
    activatePetSessionScope("scope-invalid-a", "scope-a-2");
    storage.setItem(petSessionStorageKey("scope-invalid-a"), JSON.stringify(a));
    assert.equal(invalidateCurrentPetSession("scope-invalid-a", "scope-a-1"), false);
    assert.notEqual(storage.getItem(petSessionStorageKey("scope-invalid-a")), null);
    assert.ok(isCurrentPetSessionScope("scope-invalid-a", "scope-a-2"));

    // Wrong slug is ignored even if the scope string matches.
    assert.equal(invalidateCurrentPetSession("scope-invalid-b", "scope-a-2"), false);
    assert.notEqual(storage.getItem(petSessionStorageKey("scope-invalid-b")), null);
    assert.equal(currentPetSessionScope("scope-invalid-b"), "scope-b-1");
    assert.equal(adminReads, 0, "una expiración PET nunca lee/borra auth admin");
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete (globalThis as { window?: unknown }).window;
    clearPetSessionScope("scope-invalid-a");
    clearPetSessionScope("scope-invalid-b");
  }
});

test("refresh /me: dedupe, reemplaza profile al éxito, conserva al error y 401 invalida scoped", async t => {
  const storage = new MemoryStorage();
  const session = futureSession();
  storage.setItem(petSessionStorageKey("scope-refresh"), JSON.stringify(session));
  let mode: "ok" | "error" | "unauthorized" = "ok";
  let profileResponse: { cliente: { nombre: string }; mascotas: Array<{ id: number; nombre: string }> } =
    { cliente: { nombre: "Ana" }, mascotas: [] };
  let meCalls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    meCalls++;
    assert.equal(String(input), "/api/pet/public/scope-refresh/session/me");
    assert.deepEqual(init?.headers, { Authorization: `Bearer ${session.token}` });
    if (mode === "error") throw new Error("network sentinel");
    if (mode === "unauthorized") return new Response(JSON.stringify({ error: "PET_SESSION_INVALID" }), { status: 401 });
    return new Response(JSON.stringify(profileResponse), { status: 200 });
  });
  await withTestStorage(storage, async () => {
    const restored = await restorePetSessionOnce("scope-refresh");
    assert.equal(restored.status, "authenticated");
    if (restored.status !== "authenticated") return;
    const scope = restored.sessionScope;
    const authenticatedState: PetSessionUiState = restored;

    profileResponse = { cliente: { nombre: "Ana" }, mascotas: [{ id: 3, nombre: "Milo" }] };
    const first = refreshPetSessionProfileOnce("scope-refresh", scope);
    const replay = refreshPetSessionProfileOnce("scope-refresh", scope);
    assert.equal(first, replay, "StrictMode no duplica el refresh");
    assert.notEqual(storage.getItem(petSessionStorageKey("scope-refresh")), null, "mientras carga no se borra nada");
    assert.ok(isCurrentPetSessionScope("scope-refresh", scope));
    const refreshed = await first;
    assert.deepEqual(refreshed, {
      status: "refreshed",
      profile: { cliente: { nombre: "Ana" }, mascotas: [{ id: 3, nombre: "Milo" }] },
    });
    const afterRefresh = petSessionUiStateAfterRefresh(authenticatedState, refreshed);
    assert.equal(afterRefresh.status, "authenticated");
    if (afterRefresh.status === "authenticated") {
      assert.deepEqual(afterRefresh.profile.mascotas, [{ id: 3, nombre: "Milo" }]);
    }

    mode = "error";
    const failed = await refreshPetSessionProfileOnce("scope-refresh", scope);
    assert.deepEqual(failed, { status: "error" });
    assert.deepEqual(petSessionUiStateAfterRefresh(afterRefresh, failed), afterRefresh, "conserva el profile anterior");
    assert.notEqual(storage.getItem(petSessionStorageKey("scope-refresh")), null);

    mode = "ok";
    profileResponse = { cliente: { nombre: "Ana" }, mascotas: [{ id: 3, nombre: "Milo" }, { id: 4, nombre: "Luna" }] };
    const retried = await refreshPetSessionProfileOnce("scope-refresh", scope);
    assert.equal(retried.status, "refreshed", "el error previo permite reintentar");

    mode = "unauthorized";
    const denied = await refreshPetSessionProfileOnce("scope-refresh", scope);
    assert.deepEqual(denied, { status: "unauthorized" });
    assert.equal(storage.getItem(petSessionStorageKey("scope-refresh")), null);
    assert.equal(isCurrentPetSessionScope("scope-refresh", scope), false);
    assert.deepEqual(petSessionUiStateAfterRefresh(afterRefresh, denied), { status: "expired" });

    const callsBefore = meCalls;
    assert.deepEqual(await refreshPetSessionProfileOnce("scope-refresh", scope), { status: "stale" });
    assert.equal(meCalls, callsBefore, "un scope viejo no dispara requests");
    assert.equal(meCalls, 5);
  });
});

test("logout: libera solo el scope saliente y un 401 tardío queda ignorado", async t => {
  const storage = new MemoryStorage();
  const session = futureSession();
  storage.setItem(petSessionStorageKey("scope-logout"), JSON.stringify(session));
  storage.setItem(petSessionStorageKey("scope-logout-b"), JSON.stringify(futureSession()));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/session/logout")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ cliente: { nombre: "Ana" }, mascotas: [] }), { status: 200 });
  });
  await withTestStorage(storage, async () => {
    const restored = await restorePetSessionOnce("scope-logout");
    assert.equal(restored.status, "authenticated");
    if (restored.status !== "authenticated") return;
    await logoutPetSession("scope-logout", restored.session.token);
    assert.equal(releasePetSessionScope("scope-logout", restored.sessionScope), true);
    assert.equal(invalidateCurrentPetSession("scope-logout", restored.sessionScope), false,
      "un 401 tardío ya no invalida nada");
    assert.equal(storage.getItem(petSessionStorageKey("scope-logout")), null);
    assert.notEqual(storage.getItem(petSessionStorageKey("scope-logout-b")), null);

    activatePetSessionScope("scope-logout-b", "scope-b-current");
    assert.equal(releasePetSessionScope("scope-logout", "scope-b-current"), false, "no libera otro slug");
    assert.equal(currentPetSessionScope("scope-logout-b"), "scope-b-current");
  });
  clearPetSessionScope("scope-logout-b");
});

test("acceso y vencimiento: destino canónico, logout solo autenticado y aviso conceptual", () => {
  assert.equal(petAccessRedirectPath("authenticated", "local/a"), "/local%2Fa");
  assert.ok(!String(petAccessRedirectPath("authenticated", "local/a")).includes("#"));
  assert.ok(!String(petAccessRedirectPath("authenticated", "local/a")).includes("token"));
  for (const status of ["unauthenticated", "invalid-link", "local-unavailable", "error", "loading"]) {
    assert.equal(petAccessRedirectPath(status, "local/a"), null);
  }
  assert.equal(canStartPetLogout(false, "authenticated"), true);
  assert.equal(canStartPetLogout(true, "authenticated"), false, "submitting impide iniciar logout");
  assert.equal(canStartPetLogout(false, "logging-out"), false);
  assert.equal(canStartPetLogout(false, "unauthenticated"), false);
  assert.equal(getPetLandingMode("expired"), "first-visit");
  assert.equal(PET_SESSION_EXPIRED_MESSAGE, "Tu sesión venció. Volvé a ingresar para reservar.");
});
