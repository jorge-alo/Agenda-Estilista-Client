import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterPetManagementNavigation } from "../../petManagement/state/petManagementNavigation.ts";
import { acquirePetSolicitudWriteLock, createPetSolicitudesNavigationGuard, invalidatePetSolicitudes, petSolicitudesMutationPolicy, petSolicitudesQuery } from "../queries/petSolicitudesQueries.ts";
import { PetSolicitudesApiError, petSolicitudesService } from "../services/petSolicitudes.service.ts";
import { conversionDraft, petSolicitudActions, type PetSolicitud, type PetSolicitudConversionInput, type PetSolicitudEstado } from "../types/petSolicitudes.types.ts";
import "../styles/petSolicitudes.css";

interface Props { localId: string; registerNavigation?: RegisterPetManagementNavigation }
type Draft = ReturnType<typeof conversionDraft>;
const FILTERS: { value: PetSolicitudEstado | null; label: string }[] = [
  { value: null, label: "Todas" }, { value: "NUEVA", label: "Nuevas" }, { value: "CONTACTADA", label: "Contactadas" }, { value: "CONVERTIDA", label: "Convertidas" }, { value: "DESCARTADA", label: "Descartadas" },
];
const statusLabel: Record<PetSolicitudEstado, string> = { NUEVA: "Nueva", CONTACTADA: "Contactada", CONVERTIDA: "Convertida", DESCARTADA: "Descartada" };

export function PetSolicitudesAdmin({ localId, registerNavigation }: Props) {
  const client = useQueryClient();
  const [filter, setFilter] = useState<PetSolicitudEstado | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [uncertain, setUncertain] = useState<{ id: number; kind: "estado" | "conversion"; estado?: "CONTACTADA" | "DESCARTADA" } | null>(null);
  const lock = useRef(false);
  const query = useQuery(petSolicitudesQuery(localId, filter));
  const stateMutation = useMutation({ mutationFn: ({ id, estado }: { id: number; estado: "CONTACTADA" | "DESCARTADA" }) => petSolicitudesService.changeState(id, estado), ...petSolicitudesMutationPolicy() });
  const convertMutation = useMutation({ mutationFn: ({ id, input }: { id: number; input: PetSolicitudConversionInput }) => petSolicitudesService.convert(id, input), ...petSolicitudesMutationPolicy() });
  const selected = query.data?.find(item => item.id === selectedId) ?? null;
  const dirty = !!draft;
  const busy = stateMutation.isPending || convertMutation.isPending || lock.current;

  useEffect(() => {
    if (!registerNavigation) return;
    registerNavigation(createPetSolicitudesNavigationGuard({ dirty, busy, uncertain: uncertain !== null }, () => window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y salir?")));
    return () => registerNavigation(null);
  }, [registerNavigation, dirty, busy, uncertain]);

  async function refresh() {
    try { const list = await client.fetchQuery({ ...petSolicitudesQuery(localId, null), staleTime: 0 }); await invalidatePetSolicitudes(client, localId); return list; } catch { return null; }
  }
  function canReplaceDraft() { return !draft || window.confirm("Hay cambios sin guardar. ¿Querés descartarlos?"); }
  function beginConversion(item: PetSolicitud) { if (!canReplaceDraft()) return; setSelectedId(item.id); setDraft(conversionDraft(item)); setFormError(""); setNotice(""); }
  function closeDetail() { if (draft && !window.confirm("Hay cambios sin guardar. ¿Querés descartarlos?")) return; setDraft(null); setSelectedId(null); setFormError(""); }
  async function transition(item: PetSolicitud, estado: "CONTACTADA" | "DESCARTADA") {
    if (busy || !acquirePetSolicitudWriteLock(lock)) return;
    if (estado === "DESCARTADA" && !window.confirm("¿Descartar esta solicitud?\n\nLa solicitud quedará cerrada y ya no podrá convertirse.")) { lock.current = false; return; }
    setNotice(""); setFormError("");
    try { await stateMutation.mutateAsync({ id: item.id, estado }); await invalidatePetSolicitudes(client, localId); setNotice(`Solicitud marcada como ${statusLabel[estado].toLowerCase()}.`); }
    catch (error) {
      const latest = await refresh();
      const current = latest?.find(row => row.id === item.id);
      if (current?.estado === estado) { setUncertain(null); setNotice(`El servidor confirma el estado ${statusLabel[estado].toLowerCase()}.`); }
      else if (current) { setUncertain(null); setFormError(`No se aplicó el cambio. Estado actual: ${statusLabel[current.estado]}.`); }
      else if (error instanceof PetSolicitudesApiError && [400, 401, 403, 404].includes(error.status)) setFormError(error.status === 401 ? "Tu sesión venció. Iniciá sesión nuevamente." : error.status === 403 ? "No tenés permiso para cambiar esta solicitud." : "La solicitud ya no está disponible para este cambio.");
      else { setUncertain({ id: item.id, kind: "estado", estado }); setNotice("No pudimos confirmar el cambio. Verificá el estado antes de volver a intentar."); }
    } finally { lock.current = false; }
  }
  async function submitConversion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !draft || busy || !acquirePetSolicitudWriteLock(lock)) return;
    if (!draft.responsable.nombre.trim() || !draft.responsable.telefono.trim() || !draft.mascota.nombre.trim()) { setFormError("Completá nombre y teléfono del responsable y nombre de la mascota."); lock.current = false; return; }
    setFormError(""); setNotice("");
    const input: PetSolicitudConversionInput = { responsable: { nombre: draft.responsable.nombre.trim(), telefono: draft.responsable.telefono.trim() }, mascota: { nombre: draft.mascota.nombre.trim(), raza: draft.mascota.raza?.trim() || null, fechaNacimiento: draft.mascota.fechaNacimiento || null, tamano: draft.mascota.tamano?.trim() || null, sexo: draft.mascota.sexo?.trim() || null, tipoPelo: draft.mascota.tipoPelo.trim() || null, observaciones: draft.mascota.observaciones.trim() || null } };
    try {
      const result = await convertMutation.mutateAsync({ id: selected.id, input });
      setDraft(null); setUncertain(null); setSelectedId(null);
      await invalidatePetSolicitudes(client, localId);
      setNotice(result.cliente.reutilizado ? "Se reutilizó el responsable existente y se creó una nueva mascota. Podés completar su configuración desde Mascotas." : "Se creó el responsable y su mascota. Podés completar la configuración de la mascota desde Mascotas.");
    } catch (error) {
      if (error instanceof PetSolicitudesApiError && error.code === "CLIENT_PHONE_INVALID") { setFormError("El teléfono principal no es válido. Corregilo para convertir la solicitud."); }
      else if (error instanceof PetSolicitudesApiError && error.code === "CLIENT_PHONE_CONFLICT") { setFormError("Ese teléfono entra en conflicto con otro registro del local. Revisá o corregí el teléfono principal."); }
      else {
        const latest = await refresh();
        const current = latest?.find(row => row.id === selected.id);
        if (current?.estado === "CONVERTIDA") { setDraft(null); setSelectedId(null); setNotice("El servidor confirma que la solicitud fue convertida. Verificá la ficha desde Mascotas cuando quieras."); }
        else if (error instanceof PetSolicitudesApiError && error.code === "PET_SOLICITUD_NOT_CONVERTIBLE") {
          if (latest && current) { setDraft(null); setFormError(`La solicitud cambió o ya fue cerrada. Estado actual: ${statusLabel[current.estado]}.`); }
          else { setUncertain({ id: selected.id, kind: "conversion" }); setNotice("El servidor indica que la solicitud ya no es convertible, pero no pudimos verificar su estado. El formulario se conserva; verificá nuevamente."); }
        }
        else if (error instanceof PetSolicitudesApiError && [400, 401, 403, 404].includes(error.status)) { setFormError(error.status === 401 ? "Tu sesión venció. Iniciá sesión nuevamente." : "No pudimos convertir la solicitud. Revisá los datos e intentá de nuevo."); }
        else { setUncertain({ id: selected.id, kind: "conversion" }); setNotice("No pudimos confirmar si se completó la conversión. El formulario se conserva; verificá el estado antes de intentar otra vez."); }
      }
    } finally { lock.current = false; }
  }
  async function verify() {
    if (!uncertain || !acquirePetSolicitudWriteLock(lock)) return;
    try { const list = await refresh(); const current = list?.find(item => item.id === uncertain.id);
      if (!current) { setNotice("No pudimos verificar ahora. Conservamos el contexto; intentá verificar nuevamente."); return; }
      if (uncertain.kind === "conversion" && current.estado === "CONVERTIDA") { setDraft(null); setSelectedId(null); setUncertain(null); setNotice("La solicitud está convertida según el servidor. Podés completar su configuración desde Mascotas."); }
      else if (uncertain.kind === "estado" && current.estado === uncertain.estado) { setUncertain(null); setNotice(`El servidor confirma el estado ${statusLabel[current.estado].toLowerCase()}.`); }
      else if (uncertain.kind === "conversion" && (current.estado === "DESCARTADA" || current.estado === "CONVERTIDA")) { setUncertain(null); setDraft(null); setNotice(`El estado actual es ${statusLabel[current.estado].toLowerCase()}.`); }
      else { setNotice("El resultado sigue sin poder confirmarse. Se conserva el formulario; podés verificar nuevamente."); }
    } finally { lock.current = false; }
  }

  return <section className="pet-solicitudes" aria-labelledby="pet-solicitudes-title">
    <header><h1 id="pet-solicitudes-title">Solicitudes</h1><label htmlFor="pet-solicitudes-filter">Filtrar por estado</label><select id="pet-solicitudes-filter" value={filter ?? "TODAS"} onChange={e => { setFilter(e.target.value === "TODAS" ? null : e.target.value as PetSolicitudEstado); setSelectedId(null); setDraft(null); setUncertain(null); }} disabled={busy || !!draft || !!uncertain}>{FILTERS.map(item => <option key={item.label} value={item.value ?? "TODAS"}>{item.label}</option>)}</select></header>
    {notice && <p className="pet-solicitudes__notice" role="status">{notice}</p>}{formError && <p className="pet-solicitudes__error" role="alert">{formError}</p>}
    {query.isLoading ? <p role="status">Cargando solicitudes…</p> : query.isError ? <div role="alert"><p>No pudimos cargar las solicitudes.</p><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div> : query.data?.length === 0 ? <p className="pet-solicitudes__empty" role="status">{filter ? "No hay solicitudes con este estado." : "No hay solicitudes."}</p> : <div className="pet-solicitudes__list">{query.data?.map(item => { const actions = petSolicitudActions(item.estado); return <article className="pet-solicitudes__card" key={item.id}>
      <div><h2>{item.mascota.nombre}</h2><p>{item.responsable.nombre}</p><p><a href={`tel:${item.responsable.telefono}`}>{item.responsable.telefono}</a>{item.responsable.telefonoSecundario && <> · <a href={`tel:${item.responsable.telefonoSecundario}`}>{item.responsable.telefonoSecundario}</a></>}</p><p>{formatDate(item.createdAt)}</p><p>Estado: <strong>{statusLabel[item.estado]}</strong></p></div>
      <div className="pet-solicitudes__actions"><button type="button" onClick={() => { if (!canReplaceDraft()) return; setSelectedId(item.id); setDraft(null); setNotice(""); setFormError(""); }}>Ver</button>{actions.contactar && <button type="button" disabled={busy} onClick={() => void transition(item, "CONTACTADA")}>Marcar contactada</button>}{actions.descartar && <button type="button" disabled={busy} onClick={() => void transition(item, "DESCARTADA")}>Descartar</button>}{actions.convertir && <button type="button" disabled={busy} onClick={() => beginConversion(item)}>Convertir</button>}</div>
    </article>; })}</div>}
    {selected && <section className="pet-solicitudes__detail" aria-labelledby="pet-solicitudes-detail-title"><h2 id="pet-solicitudes-detail-title">{draft ? "Revisar conversión" : `Solicitud de ${selected.mascota.nombre}`}</h2>{!draft ? <><h3>Mascota</h3><p>{selected.mascota.nombre} · {selected.mascota.raza ?? "Raza no indicada"} · {selected.mascota.fechaNacimiento ?? "Fecha de nacimiento no indicada"} · {selected.mascota.tamano ?? "Tamaño no indicado"} · {selected.mascota.sexo ?? "Sexo no indicado"}</p><h3>Responsable</h3><p>{selected.responsable.nombre} · {selected.responsable.telefono}{selected.responsable.telefonoSecundario ? ` · ${selected.responsable.telefonoSecundario}` : ""}</p><h3>Motivo de contacto</h3><p>{selected.motivoContacto || "Sin motivo indicado."}</p><p>Estado: {statusLabel[selected.estado]}</p><p>Creada: {formatDate(selected.createdAt)}</p></> : <form onSubmit={submitConversion}>
      <p>Revisá los datos antes de crear responsable y mascota. La conversión no configura servicios ni extras y deja la reserva online deshabilitada.</p>
      <fieldset disabled={busy || !!uncertain}><legend>Responsable</legend><label>Nombre<input required value={draft.responsable.nombre} onChange={e => setDraft({ ...draft, responsable: { ...draft.responsable, nombre: e.target.value } })} /></label><label>Teléfono principal<input required type="tel" autoComplete="tel" aria-describedby={formError ? "pet-solicitudes-form-error" : undefined} value={draft.responsable.telefono} onChange={e => setDraft({ ...draft, responsable: { ...draft.responsable, telefono: e.target.value } })} /></label></fieldset>
      <fieldset disabled={busy || !!uncertain}><legend>Mascota</legend><label>Nombre<input required value={draft.mascota.nombre} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, nombre: e.target.value } })} /></label><label>Raza<input value={draft.mascota.raza ?? ""} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, raza: e.target.value } })} /></label><label>Fecha de nacimiento<input type="date" value={draft.mascota.fechaNacimiento ?? ""} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, fechaNacimiento: e.target.value } })} /></label><label>Tamaño<input value={draft.mascota.tamano ?? ""} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, tamano: e.target.value } })} /></label><label>Sexo<input value={draft.mascota.sexo ?? ""} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, sexo: e.target.value } })} /></label><label>Tipo de pelo<input value={draft.mascota.tipoPelo} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, tipoPelo: e.target.value } })} /></label><label>Observaciones<textarea value={draft.mascota.observaciones} onChange={e => setDraft({ ...draft, mascota: { ...draft.mascota, observaciones: e.target.value } })} /></label></fieldset>
      {formError && <p id="pet-solicitudes-form-error" role="alert">{formError}</p>}<button type="submit" disabled={busy || !!uncertain}>{busy ? "Convirtiendo…" : "Confirmar conversión"}</button><button type="button" disabled={busy} onClick={closeDetail}>Cancelar</button>
    </form>}<button type="button" disabled={busy} onClick={closeDetail}>Cerrar detalle</button></section>}
    {uncertain && <button type="button" disabled={busy} onClick={() => void verify()}>Verificar nuevamente</button>}
  </section>;
}
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { dateStyle: "short" }).format(date); }
