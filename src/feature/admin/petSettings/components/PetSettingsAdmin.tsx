import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterPetManagementNavigation } from "../../petManagement/state/petManagementNavigation.ts";
import { acquirePetSettingsWriteLock, createPetSettingsNavigationGuard, invalidatePetSettingsDependencies, petSettingsMutationPolicy, petSettingsQuery } from "../queries/petSettingsQueries.ts";
import { PetSettingsApiError, petSettingsService } from "../services/petSettings.service.ts";
import { petSettingsDraft, petSettingsMatchesWrite, petSettingsPayload, validatePetSettingsDraft } from "../types/petSettings.types.ts";
import type { PetSettings, PetSettingsDraft, PetSettingsWrite } from "../types/petSettings.types.ts";
import "../styles/petSettings.css";

interface Props { localId: string; registerNavigation?: RegisterPetManagementNavigation }
const emptyDraft = (): PetSettingsDraft => ({ rule: null, value: "" });

export function PetSettingsAdmin({ localId, registerNavigation }: Props) {
  const client = useQueryClient();
  const query = useQuery(petSettingsQuery(localId));
  const [draft, setDraft] = useState<PetSettingsDraft>(emptyDraft);
  const [loaded, setLoaded] = useState<PetSettings | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<PetSettingsWrite | null>(null);
  const lock = useRef(false);
  const mutation = useMutation({ mutationFn: petSettingsService.replace, ...petSettingsMutationPolicy() });

  useEffect(() => {
    if (!query.data || uncertain) return;
    setLoaded(query.data);
    setDraft(petSettingsDraft(query.data));
  }, [query.data, uncertain]);

  const payload = petSettingsPayload(draft);
  const dirty = loaded !== null && (payload === null
    ? draft.rule !== loaded.highDemandRule || draft.value !== (loaded.configured ? String(loaded.highDemandRule === "MIN_GAP" ? loaded.highDemandGapMinutes : loaded.highDemandMaxPerDay) : "")
    : !petSettingsMatchesWrite(loaded, payload));
  const busy = mutation.isPending || lock.current;

  useEffect(() => {
    if (!registerNavigation) return;
    registerNavigation(createPetSettingsNavigationGuard({ dirty, busy, uncertain: uncertain !== null },
      () => window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y salir?")));
    return () => registerNavigation(null);
  }, [registerNavigation, busy, dirty, uncertain]);

  async function refresh(): Promise<PetSettings | null> {
    try { return await client.fetchQuery({ ...petSettingsQuery(localId), staleTime: 0 }); } catch { return null; }
  }
  async function accept(settings: PetSettings) {
    await invalidatePetSettingsDependencies(client, localId);
    setLoaded(settings); setDraft(petSettingsDraft(settings)); setUncertain(null); setFormError(null);
  }
  async function verify() {
    if (!uncertain || !acquirePetSettingsWriteLock(lock)) return;
    try {
      const current = await refresh();
      if (!current) { setNotice("No pudimos verificar ahora. El formulario se conserva; intentá verificar nuevamente."); return; }
      if (petSettingsMatchesWrite(current, uncertain)) { await accept(current); setNotice("La configuración quedó aplicada según el servidor."); }
      else setNotice("La configuración enviada no coincide con el estado actual. Se conserva el formulario; verificá nuevamente o decidí otro intento explícito.");
    } finally { lock.current = false; }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acquirePetSettingsWriteLock(lock)) return;
    const validation = validatePetSettingsDraft(draft); setFormError(validation);
    if (validation) { lock.current = false; return; }
    const write = petSettingsPayload(draft)!;
    if (loaded && petSettingsMatchesWrite(loaded, write)) { setFormError(null); setNotice("La configuración ya está actualizada."); lock.current = false; return; }
    setNotice(null);
    try {
      const stored = await mutation.mutateAsync(write);
      await accept(stored); setNotice("Configuración guardada.");
    } catch (error: unknown) {
      if (error instanceof PetSettingsApiError && [400, 401, 403].includes(error.status)) {
        setFormError(error.status === 400 ? "La configuración no es válida. Revisá la regla y el valor." : error.status === 401 ? "Tu sesión venció. Iniciá sesión nuevamente." : "No tenés permiso para cambiar esta configuración.");
      } else {
        const current = await refresh();
        if (current && petSettingsMatchesWrite(current, write)) { await accept(current); setNotice("La configuración quedó aplicada según el servidor."); }
        else { setUncertain(write); setNotice("No pudimos confirmar el resultado. El formulario se conserva; verificá antes de volver a guardar."); }
      }
    } finally { lock.current = false; }
  }

  return <section className="pet-settings" aria-labelledby="pet-settings-title">
    <header className="pet-settings__header"><h1 id="pet-settings-title">Configuración de alta exigencia</h1><p>Definí cómo se organizan los turnos de las mascotas ya clasificadas como de alta exigencia.</p></header>
    {notice && <p className="pet-settings__notice" role="status">{notice}</p>}
    {query.isLoading ? <p role="status">Cargando configuración…</p> : query.isError ? <div className="pet-settings__message" role="alert"><p>{settingsErrorMessage(query.error)}</p><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div> : <>
      {loaded && !loaded.configured && <p className="pet-settings__empty" role="status">Todavía no hay una regla configurada. Elegí una opción para guardar la primera configuración.</p>}
      <form className="pet-settings__card" onSubmit={submit} noValidate>
        <fieldset disabled={busy || uncertain !== null}>
          <legend>Regla para mascotas de alta exigencia</legend>
          <label className="pet-settings__option"><input type="radio" name="high-demand-rule" value="MIN_GAP" checked={draft.rule === "MIN_GAP"} onChange={() => { setDraft({ rule: "MIN_GAP", value: "" }); setFormError(null); setNotice(null); }} /> <span><strong>Separación mínima entre turnos</strong><small>Deja un intervalo de descanso entre turnos de alta exigencia.</small></span></label>
          <label className="pet-settings__option"><input type="radio" name="high-demand-rule" value="MAX_PER_DAY" checked={draft.rule === "MAX_PER_DAY"} onChange={() => { setDraft({ rule: "MAX_PER_DAY", value: "" }); setFormError(null); setNotice(null); }} /> <span><strong>Máximo de turnos por día</strong><small>Limita cuántos turnos de alta exigencia se permiten en un día.</small></span></label>
        </fieldset>
        {draft.rule && <div className="pet-settings__value"><label htmlFor="pet-settings-value">{draft.rule === "MIN_GAP" ? "Separación mínima" : "Máximo por día"}</label><div className="pet-settings__input"><input id="pet-settings-value" type="number" min="1" step="1" inputMode="numeric" value={draft.value} aria-describedby={formError ? "pet-settings-error" : "pet-settings-unit"} onChange={event => setDraft({ ...draft, value: event.target.value })} disabled={busy || uncertain !== null} /><span id="pet-settings-unit">{draft.rule === "MIN_GAP" ? "minutos" : "turnos"}</span></div></div>}
        {formError && <p id="pet-settings-error" className="pet-settings__error" role="alert">{formError}</p>}
        <button className="pet-settings__primary" type="submit" disabled={busy || uncertain !== null || !draft.rule}>{busy ? "Guardando…" : "Guardar configuración"}</button>
      </form>
      {uncertain && <button className="pet-settings__secondary" type="button" disabled={busy} onClick={() => void verify()}>Verificar nuevamente</button>}
    </>}
  </section>;
}

function settingsErrorMessage(error: unknown): string {
  if (error instanceof PetSettingsApiError && error.status === 401) return "Tu sesión venció. Iniciá sesión nuevamente.";
  if (error instanceof PetSettingsApiError && error.status === 403) return "No tenés permiso para consultar esta configuración.";
  return "No pudimos cargar la configuración. Intentá nuevamente.";
}
