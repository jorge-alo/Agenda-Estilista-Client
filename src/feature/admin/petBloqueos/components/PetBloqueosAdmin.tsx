import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RegisterPetManagementNavigation } from "../../petManagement/state/petManagementNavigation.ts";
import { acquirePetBloqueoWriteLock, invalidatePetBloqueoDependencies, petBloqueoChangeApplied, petBloqueoMutationPolicy, petBloqueosQuery } from "../queries/petBloqueosQueries.ts";
import type { PetBloqueoVerification } from "../queries/petBloqueosQueries.ts";
import { PetBloqueosApiError, petBloqueosService } from "../services/petBloqueos.service.ts";
import { normalizePetBloqueoTime, petBloqueoDraft, petBloqueoPayload, petBloqueoPatch, validatePetBloqueoDraft } from "../types/petBloqueos.types.ts";
import type { PetBloqueo, PetBloqueoDraft } from "../types/petBloqueos.types.ts";
import { petBloqueoDateLabel, petBloqueosErrorMessage } from "./petBloqueosView.ts";
import "../styles/petBloqueos.css";

interface Props { localId: string; registerNavigation?: RegisterPetManagementNavigation }
const emptyDraft = (): PetBloqueoDraft => ({ fecha: "", esDiaCompleto: true, horaInicio: "09:00", horaFin: "10:00", motivo: "" });
const isKnownError = (error: unknown) => error instanceof PetBloqueosApiError && [400, 401, 403, 404, 409].includes(error.status);

export function PetBloqueosAdmin({ localId, registerNavigation }: Props) {
  const client = useQueryClient();
  const query = useQuery(petBloqueosQuery(localId));
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<PetBloqueoDraft>(emptyDraft());
  const [errors, setErrors] = useState<Partial<Record<keyof PetBloqueoDraft, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [verification, setVerification] = useState<PetBloqueoVerification | null>(null);
  const lock = useRef(false);
  const createMutation = useMutation({ mutationFn: petBloqueosService.create, ...petBloqueoMutationPolicy() });
  const patchMutation = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: ReturnType<typeof petBloqueoPayload> }) => petBloqueosService.update(id, payload), ...petBloqueoMutationPolicy() });
  const deleteMutation = useMutation({ mutationFn: petBloqueosService.remove, ...petBloqueoMutationPolicy() });
  const busy = createMutation.isPending || patchMutation.isPending || deleteMutation.isPending || lock.current;
  const dirty = creating || editingId !== null || verification !== null;

  useEffect(() => {
    if (!registerNavigation) return;
    registerNavigation({ hasPendingChanges: () => dirty || busy, canLeave: () => !busy && (!dirty || window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y salir?")) });
    return () => registerNavigation(null);
  }, [registerNavigation, dirty, busy]);

  async function refresh(): Promise<PetBloqueo[] | null> {
    try { return await client.fetchQuery({ ...petBloqueosQuery(localId), staleTime: 0 }); } catch { return null; }
  }
  async function afterWrite() {
    await invalidatePetBloqueoDependencies(client, localId);
    setVerification(null); setCreating(false); setEditingId(null); setErrors({});
  }
  async function verify() {
    if (!verification || !acquirePetBloqueoWriteLock(lock)) return;
    try {
      const records = await refresh();
      if (!records) { setNotice("No pudimos verificar ahora. El formulario se conserva; intentá verificar nuevamente."); return; }
      if (petBloqueoChangeApplied(records, verification)) { await afterWrite(); setNotice("El cambio quedó confirmado según los bloqueos actuales del servidor."); }
      else setNotice("El cambio no pudo confirmarse. El formulario se conserva; verificá nuevamente o decidí otro intento explícito.");
    } finally { lock.current = false; }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const validation = validatePetBloqueoDraft(createDraft); setErrors(validation); if (Object.keys(validation).length) return;
    const payload = petBloqueoPayload(createDraft); const before = query.data ?? [];
    if (!acquirePetBloqueoWriteLock(lock)) return;
    setNotice(null);
    try { await createMutation.mutateAsync(payload); await afterWrite(); setNotice("Bloqueo creado."); toast.success("Bloqueo creado."); }
    catch (error: unknown) {
      if (isKnownError(error)) setNotice(petBloqueosErrorMessage(error));
      else {
        const pending: PetBloqueoVerification = { kind: "create", expected: payload, previousIds: before.map(item => item.id) };
        const records = await refresh();
        if (records && petBloqueoChangeApplied(records, pending)) { await afterWrite(); setNotice("El bloqueo quedó creado según el servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar si se creó. Se conserva el formulario; verificá antes de volver a enviarlo."); }
      }
    } finally { lock.current = false; }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, record: PetBloqueo) {
    event.preventDefault(); if (lock.current) return;
    const validation = validatePetBloqueoDraft(editDraft); setErrors(validation); if (Object.keys(validation).length) return;
    const payload = petBloqueoPatch(editDraft);
    if (!acquirePetBloqueoWriteLock(lock)) return;
    setNotice(null);
    try { await patchMutation.mutateAsync({ id: record.id, payload }); await afterWrite(); setNotice("Bloqueo actualizado."); toast.success("Bloqueo actualizado."); }
    catch (error: unknown) {
      if (isKnownError(error)) { setNotice(petBloqueosErrorMessage(error)); if (error instanceof PetBloqueosApiError && error.status === 404) await refresh(); }
      else {
        const pending: PetBloqueoVerification = { kind: "update", id: record.id, expected: payload };
        const records = await refresh();
        if (records && petBloqueoChangeApplied(records, pending)) { await afterWrite(); setNotice("La edición quedó aplicada según el servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar la edición. Se conserva el formulario; verificá antes de volver a guardar."); }
      }
    } finally { lock.current = false; }
  }

  async function remove(record: PetBloqueo) {
    if (lock.current || !window.confirm("¿Eliminar este bloqueo?\n\nLa fecha/período volverá a depender de los horarios y demás reglas de disponibilidad.")) return;
    if (!acquirePetBloqueoWriteLock(lock)) return;
    setNotice(null);
    try { await deleteMutation.mutateAsync(record.id); await afterWrite(); setNotice("Bloqueo eliminado."); toast.success("Bloqueo eliminado."); }
    catch (error: unknown) {
      if (isKnownError(error)) { setNotice(petBloqueosErrorMessage(error)); if (error instanceof PetBloqueosApiError && error.status === 404) await refresh(); }
      else {
        const pending: PetBloqueoVerification = { kind: "delete", id: record.id }; const records = await refresh();
        if (records && petBloqueoChangeApplied(records, pending)) { await afterWrite(); setNotice("El bloqueo ya no aparece en el servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar la eliminación. Verificá antes de volver a eliminarlo."); }
      }
    } finally { lock.current = false; }
  }

  const form = (draft: PetBloqueoDraft, update: (value: PetBloqueoDraft) => void, id: string) => <>
    <div><label htmlFor={`${id}-date`}>Fecha</label><input id={`${id}-date`} type="date" value={draft.fecha} onChange={event => update({ ...draft, fecha: event.target.value })} disabled={busy} aria-invalid={Boolean(errors.fecha)} aria-describedby={errors.fecha ? `${id}-date-error` : undefined} />{errors.fecha && <p id={`${id}-date-error`} className="pet-bloqueos__error">{errors.fecha}</p>}</div>
    <fieldset className="pet-bloqueos__type"><legend>Tipo de bloqueo</legend><label><input type="radio" name={`${id}-kind`} checked={draft.esDiaCompleto} onChange={() => update({ ...draft, esDiaCompleto: true })} disabled={busy} /> Día completo</label><label><input type="radio" name={`${id}-kind`} checked={!draft.esDiaCompleto} onChange={() => update({ ...draft, esDiaCompleto: false })} disabled={busy} /> Parcial</label></fieldset>
    {!draft.esDiaCompleto && <div className="pet-bloqueos__times"><div><label htmlFor={`${id}-start`}>Hora de inicio</label><input id={`${id}-start`} type="time" value={draft.horaInicio} onChange={event => update({ ...draft, horaInicio: event.target.value })} disabled={busy} aria-invalid={Boolean(errors.horaInicio)} aria-describedby={errors.horaInicio ? `${id}-start-error` : undefined} />{errors.horaInicio && <p id={`${id}-start-error`} className="pet-bloqueos__error">{errors.horaInicio}</p>}</div><div><label htmlFor={`${id}-end`}>Hora de fin</label><input id={`${id}-end`} type="time" value={draft.horaFin} onChange={event => update({ ...draft, horaFin: event.target.value })} disabled={busy} aria-invalid={Boolean(errors.horaFin)} aria-describedby={errors.horaFin ? `${id}-end-error` : undefined} />{errors.horaFin && <p id={`${id}-end-error`} className="pet-bloqueos__error">{errors.horaFin}</p>}</div></div>}
    <div><label htmlFor={`${id}-reason`}>Motivo (opcional)</label><input id={`${id}-reason`} type="text" maxLength={255} value={draft.motivo} onChange={event => update({ ...draft, motivo: event.target.value })} placeholder="Feriado, turno médico, mantenimiento…" disabled={busy} aria-invalid={Boolean(errors.motivo)} aria-describedby={errors.motivo ? `${id}-reason-error` : undefined} />{errors.motivo && <p id={`${id}-reason-error`} className="pet-bloqueos__error">{errors.motivo}</p>}</div>
  </>;

  return <section className="pet-bloqueos" aria-labelledby="pet-bloqueos-title">
    <header className="pet-bloqueos__header"><div><h1 id="pet-bloqueos-title">Bloqueos</h1><p>Cerrá fechas completas o períodos puntuales de la agenda del equipo.</p></div><button className="pet-bloqueos__primary" type="button" disabled={busy || creating || editingId !== null || Boolean(verification)} onClick={() => { setCreating(true); setCreateDraft(emptyDraft()); setErrors({}); setNotice(null); }}>+ Agregar bloqueo</button></header>
    {notice && <p className="pet-bloqueos__notice" role="status">{notice}</p>}
    {verification && <button className="pet-bloqueos__secondary" type="button" disabled={busy} onClick={() => void verify()}>Verificar nuevamente</button>}
    {creating && <form className="pet-bloqueos__form" onSubmit={submitCreate} noValidate><h2>Nuevo bloqueo</h2>{form(createDraft, setCreateDraft, "pet-bloqueos-create")}<div className="pet-bloqueos__actions"><button className="pet-bloqueos__primary" type="submit" disabled={busy || Boolean(verification)}>Crear bloqueo</button><button className="pet-bloqueos__secondary" type="button" disabled={busy} onClick={() => { setCreating(false); setErrors({}); }}>Cancelar</button></div></form>}
    {query.isLoading ? <p role="status">Cargando bloqueos…</p> : query.isError ? <div className="pet-bloqueos__message" role="alert"><p>{petBloqueosErrorMessage(query.error)}</p><button className="pet-bloqueos__secondary" type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div> : !query.data?.length ? <p className="pet-bloqueos__empty">No hay bloqueos configurados.</p> : <div className="pet-bloqueos__list">{query.data.map(record => <article className="pet-bloqueos__card" key={record.id}>
      {editingId === record.id ? <form className="pet-bloqueos__form" onSubmit={event => void saveEdit(event, record)} noValidate><h2>Editar bloqueo</h2>{form(editDraft, setEditDraft, `pet-bloqueos-edit-${record.id}`)}<div className="pet-bloqueos__actions"><button className="pet-bloqueos__primary" type="submit" disabled={busy || Boolean(verification)}>Guardar</button><button className="pet-bloqueos__secondary" type="button" disabled={busy} onClick={() => { setEditingId(null); setErrors({}); }}>Cancelar</button></div></form> : <><div className="pet-bloqueos__summary"><h2>{petBloqueoDateLabel(record.fecha)}</h2><span className="pet-bloqueos__badge">{record.es_dia_completo === 1 ? "Día completo" : `${normalizePetBloqueoTime(record.hora_inicio)} – ${normalizePetBloqueoTime(record.hora_fin)}`}</span>{record.motivo && <p>{record.motivo}</p>}</div><div className="pet-bloqueos__actions"><button className="pet-bloqueos__secondary" type="button" disabled={busy || Boolean(verification)} onClick={() => { setEditingId(record.id); setEditDraft(petBloqueoDraft(record)); setErrors({}); setNotice(null); }}>Editar</button><button className="pet-bloqueos__danger" type="button" disabled={busy || Boolean(verification)} onClick={() => void remove(record)}>Eliminar bloqueo</button></div></>}
    </article>)}</div>}
  </section>;
}
