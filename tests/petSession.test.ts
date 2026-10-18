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
  consumePetMagicLinkOnce,
  logoutPetSession,
  restorePetSessionOnce,
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
