import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RegisterPetManagementNavigation } from "../../petManagement/state/petManagementNavigation.ts";
import { petHorarioMutationPolicy, petHorariosQuery, invalidatePetHorarioDependencies } from "../queries/petHorariosQueries.ts";
import { PetHorariosApiError, petHorariosService } from "../services/petHorarios.service.ts";
import { PET_DAYS, normalizePetTime, petHorarioPatch, validatePetHorarioDraft } from "../types/petHorarios.types.ts";
import type { PetHorario, PetHorarioWrite } from "../types/petHorarios.types.ts";
import { petHorarioChangeApplied, petHorarioDayState, petHorarioTimeLabel, petHorariosErrorMessage } from "./petHorariosView.ts";
import "../styles/petHorarios.css";

interface Props { localId: string; registerNavigation?: RegisterPetManagementNavigation }
interface Draft { diaSemana: number | ""; horaInicio: string; horaFin: string }
type Verification = { kind: "create"; expected: Draft } | { kind: "update"; id: number; expected: PetHorarioWrite } | { kind: "delete"; id: number };
const blankDraft = (day: number | ""): Draft => ({ diaSemana: day, horaInicio: "09:00", horaFin: "17:00" });

export function PetHorariosAdmin({ localId, registerNavigation }: Props) {
  const client = useQueryClient();
  const query = useQuery(petHorariosQuery(localId));
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(blankDraft(1));
  const [createFormDay, setCreateFormDay] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(blankDraft(""));
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const lock = useRef(false);
  const createMutation = useMutation({ mutationFn: petHorariosService.create, ...petHorarioMutationPolicy() });
  const patchMutation = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: PetHorarioWrite }) => petHorariosService.update(id, patch), ...petHorarioMutationPolicy() });
  const deleteMutation = useMutation({ mutationFn: petHorariosService.remove, ...petHorarioMutationPolicy() });
  const busy = createMutation.isPending || patchMutation.isPending || deleteMutation.isPending || lock.current;
  const dirty = creating || editingId !== null || verification !== null;

  useEffect(() => {
    if (!registerNavigation) return;
    registerNavigation({ hasPendingChanges: () => dirty || busy, canLeave: () => !busy && (!dirty || window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y salir?")) });
    return () => registerNavigation(null);
  }, [registerNavigation, dirty, busy]);

  async function refresh(): Promise<PetHorario[] | null> {
    try { return await client.fetchQuery({ ...petHorariosQuery(localId), staleTime: 0 }); } catch { return null; }
  }
  async function afterWrite() {
    await invalidatePetHorarioDependencies(client, localId);
    setVerification(null); setCreating(false); setEditingId(null); setFormError(null);
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const error = validatePetHorarioDraft(createDraft); setFormError(error); if (error) return;
    lock.current = true; setNotice(null);
    try {
      await createMutation.mutateAsync({ diaSemana: createDraft.diaSemana as number, horaInicio: createDraft.horaInicio, horaFin: createDraft.horaFin });
      await afterWrite(); setNotice("Tramo horario creado."); toast.success("Tramo horario creado.");
    } catch (cause) {
      if (cause instanceof PetHorariosApiError && cause.status === 409) setFormError(petHorariosErrorMessage(cause));
      else if (cause instanceof PetHorariosApiError && [400, 401, 403].includes(cause.status)) setFormError(petHorariosErrorMessage(cause));
      else {
        const pending = { kind: "create" as const, expected: createDraft }; const current = await refresh();
        if (current && petHorarioChangeApplied(current, pending)) { await afterWrite(); setNotice("El tramo quedó creado según los horarios actuales del servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar si se creó el tramo. El formulario se conserva; verificá antes de volver a enviarlo."); }
      }
    } finally { lock.current = false; }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, horario: PetHorario) {
    event.preventDefault(); if (lock.current) return;
    const validation = validatePetHorarioDraft(editDraft); setFormError(validation); if (validation) return;
    const patch = petHorarioPatch(horario, editDraft);
    if (!Object.keys(patch).length) { setEditingId(null); setFormError(null); return; }
    if (editDraft.diaSemana !== horario.dia_semana || editDraft.horaInicio !== normalizePetTime(horario.hora_inicio) || editDraft.horaFin !== normalizePetTime(horario.hora_fin)) {
      const final = { ...horario, dia_semana: editDraft.diaSemana as number, hora_inicio: editDraft.horaInicio, hora_fin: editDraft.horaFin };
      if (final.activo === 1 && (query.data ?? []).some(other => other.id !== horario.id && other.activo === 1 && other.dia_semana === final.dia_semana && final.hora_inicio < normalizePetTime(other.hora_fin) && final.hora_fin > normalizePetTime(other.hora_inicio))) {
        setFormError("El tramo se solapa con otro horario activo de ese día."); return;
      }
    }
    lock.current = true; setNotice(null);
    try { await patchMutation.mutateAsync({ id: horario.id, patch }); await afterWrite(); setNotice("Tramo horario actualizado."); toast.success("Tramo horario actualizado."); }
    catch (cause) {
      if (cause instanceof PetHorariosApiError && [400, 401, 403, 409].includes(cause.status)) setFormError(petHorariosErrorMessage(cause));
      else {
        const pending = { kind: "update" as const, id: horario.id, expected: patch }; const current = await refresh();
        if (current && petHorarioChangeApplied(current, pending)) { await afterWrite(); setNotice("La edición quedó aplicada según el servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar la edición. Se conserva el formulario; verificá antes de volver a guardar."); }
      }
    } finally { lock.current = false; }
  }

  async function toggle(horario: PetHorario) {
    if (lock.current) return;
    const activo = horario.activo !== 1; lock.current = true; setNotice(null);
    try { await patchMutation.mutateAsync({ id: horario.id, patch: { activo } }); await afterWrite(); setNotice(activo ? "Tramo activado." : "Tramo desactivado. El tramo sigue disponible para editar o reactivar."); toast.success(activo ? "Tramo activado." : "Tramo desactivado."); }
    catch (cause) {
      if (cause instanceof PetHorariosApiError && [400, 401, 403, 409].includes(cause.status)) setNotice(petHorariosErrorMessage(cause));
      else {
        const pending = { kind: "update" as const, id: horario.id, expected: { activo } }; const current = await refresh();
        if (current && petHorarioChangeApplied(current, pending)) { await afterWrite(); setNotice(activo ? "El tramo quedó activado según el servidor." : "El tramo quedó desactivado según el servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar el estado. Verificá antes de volver a cambiarlo."); }
      }
    } finally { lock.current = false; }
  }

  async function remove(horario: PetHorario) {
    if (lock.current || !window.confirm("¿Eliminar este tramo horario?\n\nSe eliminará definitivamente de la configuración semanal.")) return;
    lock.current = true; setNotice(null);
    try { await deleteMutation.mutateAsync(horario.id); await afterWrite(); setNotice("Tramo eliminado."); toast.success("Tramo eliminado."); }
    catch (cause) {
      if (cause instanceof PetHorariosApiError && [400, 401, 403].includes(cause.status)) setNotice(petHorariosErrorMessage(cause));
      else {
        const pending = { kind: "delete" as const, id: horario.id }; const current = await refresh();
        if (current && petHorarioChangeApplied(current, pending)) { await afterWrite(); setNotice("El tramo ya no aparece en la configuración del servidor."); }
        else { setVerification(pending); setNotice("No pudimos confirmar la eliminación. Verificá antes de volver a eliminarlo."); }
      }
    } finally { lock.current = false; }
  }

  async function verify() {
    if (!verification || lock.current) return;
    lock.current = true;
    try {
      const records = await refresh();
      if (!records) { setNotice("No pudimos verificar ahora. El formulario se conserva; intentá verificar nuevamente."); return; }
      const pending = verification;
      const found = petHorarioChangeApplied(records, pending);
      if (found) { await afterWrite(); setNotice("El cambio quedó aplicado según los horarios actuales del servidor."); }
      else setNotice("El cambio no pudo confirmarse. El formulario se conserva; podés verificar nuevamente o decidir otro intento explícito.");
    } finally { lock.current = false; }
  }

  const records = query.data ?? [];
  const dayRecords = (day: number) => records.filter(item => item.dia_semana === day).toSorted((a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || a.id - b.id);
  const form = (draft: Draft, update: (value: Draft) => void, id: string) => <>
    <label htmlFor={`${id}-day`}>Día</label><select id={`${id}-day`} value={draft.diaSemana} onChange={event => update({ ...draft, diaSemana: event.target.value === "" ? "" : Number(event.target.value) })} disabled={busy}>
      <option value="">Elegí un día</option>{PET_DAYS.map(day => <option key={day.id} value={day.id}>{day.label}</option>)}
    </select>
    <div className="pet-horarios__times"><div><label htmlFor={`${id}-start`}>Hora de inicio</label><input id={`${id}-start`} type="time" value={draft.horaInicio} onChange={event => update({ ...draft, horaInicio: event.target.value })} disabled={busy} /></div>
      <div><label htmlFor={`${id}-end`}>Hora de fin</label><input id={`${id}-end`} type="time" value={draft.horaFin} onChange={event => update({ ...draft, horaFin: event.target.value })} disabled={busy} /></div></div>
    {formError && <p className="pet-horarios__error" role="alert">{formError}</p>}
  </>;

  return <section className="pet-horarios" aria-labelledby="pet-horarios-title">
    <header className="pet-horarios__header"><div><h1 id="pet-horarios-title">Horarios</h1><p>Configurá los tramos semanales en los que atiende el equipo.</p></div>
      <button className="pet-horarios__primary" type="button" disabled={busy || creating} onClick={() => { setCreating(true); setCreateFormDay(1); setCreateDraft(blankDraft(1)); setFormError(null); setNotice(null); }}>+ Agregar tramo</button></header>
    {notice && <p className="pet-horarios__notice" role="status">{notice}</p>}
    {verification && <button className="pet-horarios__secondary" type="button" disabled={busy} onClick={() => void verify()}>Verificar nuevamente</button>}
    {query.isLoading ? <p role="status">Cargando horarios…</p> : query.isError ? <div className="pet-horarios__message" role="alert"><p>{petHorariosErrorMessage(query.error)}</p><button className="pet-horarios__secondary" type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div> : <div className="pet-horarios__week">
      {PET_DAYS.map(day => { const items = dayRecords(day.id); const state = petHorarioDayState(items); return <section className="pet-horarios__day" key={day.id} aria-labelledby={`pet-horarios-day-${day.id}`}>
        <header><h2 id={`pet-horarios-day-${day.id}`}>{day.label}</h2><span>{state === "closed" ? "Cerrado" : "Abierto"}</span></header>
        {creating && createFormDay === day.id && <form className="pet-horarios__form" onSubmit={submitCreate} noValidate>
          <h2>Nuevo tramo — {day.label}</h2>
          {form(createDraft, value => {
            setCreateDraft(value);
            if (value.diaSemana !== "") setCreateFormDay(value.diaSemana);
          }, "pet-horarios-create")}
          <div className="pet-horarios__actions"><button className="pet-horarios__primary" type="submit" disabled={busy || Boolean(verification)}>Crear tramo</button><button className="pet-horarios__secondary" type="button" disabled={busy} onClick={() => { setCreating(false); setFormError(null); }}>Cancelar</button></div>
        </form>}
        {!items.length && <p className="pet-horarios__closed">Cerrado</p>}
        <ul>{items.map(horario => <li className={`pet-horarios__item${horario.activo ? "" : " is-inactive"}`} key={horario.id}>
          {editingId === horario.id ? <form className="pet-horarios__edit" onSubmit={event => void saveEdit(event, horario)} noValidate>
            {form(editDraft, setEditDraft, `pet-horarios-edit-${horario.id}`)}<div className="pet-horarios__actions"><button className="pet-horarios__primary" type="submit" disabled={busy || Boolean(verification)}>Guardar</button><button className="pet-horarios__secondary" type="button" disabled={busy} onClick={() => { setEditingId(null); setFormError(null); }}>Cancelar</button></div>
          </form> : <><div className="pet-horarios__item-main"><strong>{petHorarioTimeLabel(horario.hora_inicio, horario.hora_fin)}</strong><span className={`pet-horarios__status${horario.activo ? "" : " is-inactive"}`}>{horario.activo ? "Activo" : "Inactivo"}</span></div>
            <div className="pet-horarios__actions"><button className="pet-horarios__secondary" type="button" disabled={busy || Boolean(verification)} onClick={() => { setEditingId(horario.id); setEditDraft({ diaSemana: horario.dia_semana, horaInicio: normalizePetTime(horario.hora_inicio), horaFin: normalizePetTime(horario.hora_fin) }); setFormError(null); setNotice(null); }}>Editar</button><button className="pet-horarios__secondary" type="button" disabled={busy || Boolean(verification)} onClick={() => void toggle(horario)}>{horario.activo ? "Desactivar" : "Activar"}</button><button className="pet-horarios__danger" type="button" disabled={busy || Boolean(verification)} onClick={() => void remove(horario)}>Eliminar tramo</button></div></>}
        </li>)}</ul>
        <button className="pet-horarios__add" type="button" disabled={busy || creating || Boolean(verification)} onClick={() => { setCreating(true); setCreateFormDay(day.id); setCreateDraft(blankDraft(day.id)); setFormError(null); setNotice(null); }}>+ Agregar tramo</button>
      </section>; })}
    </div>}
  </section>;
}
