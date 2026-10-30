import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.(?:[cm]?js|tsx?|json|css)$/.test(specifier)) {
      try { return nextResolve(`${specifier}.ts`, context); } catch { return nextResolve(`${specifier}.tsx`, context); }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith("/hooks/usePetSession.ts")) {
      return { format: "module", shortCircuit: true, source: "export function usePetSession() { return globalThis.petEntryTestSession; }" };
    }
    if (url.endsWith("/components/PetBookingFlow.tsx")) {
      return { format: "module", shortCircuit: true, source: "import { createElement } from 'react'; export function PetBookingFlow() { return createElement('p', null, 'BOOKING_PET_TEST'); }" };
    }
    if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "" };
    if (url.endsWith(".tsx")) {
      return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
      }).outputText };
    }
    return nextLoad(url, context);
  },
});

const { PetPublicEntry, PetPublicLanding } = await import("../src/feature/publicPet/PetPublicLanding.tsx");
type EntryView = "selector" | "primera-visita" | "cliente-existente";
const queryClient = new QueryClient();

function html(element: ReactNode): string {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, element));
}

function button(element: ReactNode, label: string): ReactElement<{ onClick: () => void; disabled?: boolean }> {
  if (!isValidElement(element)) throw new Error(`No se encontró el botón: ${label}`);
  const props = element.props as { children?: ReactNode; onClick?: () => void; disabled?: boolean };
  if (element.type === "button" && html(element).includes(label)) {
    return element as ReactElement<{ onClick: () => void; disabled?: boolean }>;
  }
  for (const child of [props.children].flat(Infinity) as ReactNode[]) {
    try { return button(child, label); } catch { /* buscar en el siguiente hijo */ }
  }
  throw new Error(`No se encontró el botón: ${label}`);
}

test("landing PET: restauración precede al selector; sesión válida entra en booking; vencida conserva aviso", () => {
  const state = (status: string) => {
    (globalThis as typeof globalThis & { petEntryTestSession: unknown }).petEntryTestSession = {
      state: status === "authenticated"
        ? { status, session: { token: "test", expiresAt: "2099-01-01" }, sessionScope: "scope", profile: { cliente: { nombre: "Ana" }, mascotas: [] } }
        : { status },
    };
    return html(createElement(PetPublicLanding, { slug: "local", nombreLocal: "Local PET" }));
  };

  for (const status of ["loading", "logging-out"]) {
    assert.doesNotMatch(state(status), /¿Cómo querés continuar\?/);
  }
  assert.match(state("loading"), /Validando sesión/);
  const authenticated = state("authenticated");
  assert.match(authenticated, /BOOKING_PET_TEST/);
  assert.doesNotMatch(authenticated, /¿Cómo querés continuar\?|Reservar turno/);
  const error = state("error");
  assert.match(error, /No pudimos validar tu sesión/);
  assert.doesNotMatch(error, /¿Cómo querés continuar\?/);

  for (const status of ["unauthenticated", "expired"]) {
    const page = state(status);
    assert.match(page, /Peluquería canina/);
    assert.match(page, /Local PET/);
    assert.match(page, /Reservar turno/);
    assert.match(page, /¿Cómo querés continuar\?/);
    assert.match(page, /Primera vez en el local/);
    assert.match(page, /Ya soy cliente/);
    assert.doesNotMatch(page, /pet-first-visit-form|pet-existing-client-phone/);
    if (status === "expired") assert.match(page, /Tu sesión venció\. Volvé a ingresar para reservar\./);
  }
});

test("selector PET: botones eligen cada vista y Volver desmonta el formulario o teléfono", () => {
  let view: EntryView = "selector";
  let pending = false;
  const renderEntry = () => PetPublicEntry({
    slug: "local", view, requestPending: pending,
    onChoose: next => { view = next; },
    onBack: () => { view = "selector"; },
    onSubmittingChange: next => { pending = next; },
  });

  let entry = renderEntry();
  let markup = html(entry);
  assert.match(markup, /<button[^>]*type="button"[^>]*>.*Primera vez en el local/s);
  assert.match(markup, /Completá tus datos para solicitar tu primera visita\./);
  assert.match(markup, /Ingresá con tu celular para acceder a tus mascotas y reservar\./);
  assert.doesNotMatch(markup, /pet-first-visit-form|pet-existing-client-phone/);

  button(entry, "Primera vez en el local").props.onClick();
  entry = renderEntry();
  markup = html(entry);
  assert.match(markup, /Conocé nuestro espacio/);
  assert.match(markup, /class="pet-first-visit-form"/);
  assert.match(markup, /Nombre y apellido/);
  assert.match(markup, /Volver/);
  button(entry, "Volver").props.onClick();
  assert.equal(view, "selector");
  assert.doesNotMatch(html(renderEntry()), /pet-first-visit-form/);

  button(renderEntry(), "Ya soy cliente").props.onClick();
  entry = renderEntry();
  markup = html(entry);
  assert.match(markup, /Te enviaremos un enlace de acceso por WhatsApp/);
  assert.match(markup, /id="pet-existing-client-phone"/);
  assert.match(markup, /Enviar enlace por WhatsApp/);
  assert.doesNotMatch(markup, /Solicitar acceso|>Cancelar</);
  button(entry, "Volver").props.onClick();
  assert.equal(view, "selector");
  assert.doesNotMatch(html(renderEntry()), /pet-existing-client-phone/);
});

test("selector PET: request pendiente deshabilita Volver y evita ocultar feedback", () => {
  let view: EntryView = "primera-visita";
  let attempts = 0;
  const entry = (pending: boolean) => PetPublicEntry({
    slug: "local", view, requestPending: pending,
    onChoose: next => { view = next; },
    onBack: () => { attempts++; view = "selector"; },
    onSubmittingChange: () => {},
  });
  for (view of ["primera-visita", "cliente-existente"] as EntryView[]) {
    attempts = 0;
    const pending = entry(true);
    assert.equal(button(pending, "Volver").props.disabled, true);
    button(pending, "Volver").props.onClick();
    assert.equal(attempts, 0);
    assert.equal(view === "primera-visita" ? html(pending).includes("pet-first-visit-form") : html(pending).includes("pet-existing-client-phone"), true);
    const completed = entry(false);
    assert.equal(button(completed, "Volver").props.disabled, false);
    button(completed, "Volver").props.onClick();
    assert.equal(view, "selector");
  }
});
