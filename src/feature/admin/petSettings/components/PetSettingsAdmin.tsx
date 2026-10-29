import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterPetManagementNavigation } from "../../petManagement/state/petManagementNavigation.ts";
import { acceptPetCapacity, acquirePetSettingsWriteLock, createPetSettingsNavigationGuard, invalidatePetSettingsDependencies, petSettingsMutationPolicy, petSettingsQuery } from "../queries/petSettingsQueries.ts";
import { PetSettingsApiError, petSettingsService } from "../services/petSettings.service.ts";
import { petCapacityPayload, petSettingsDraft, petSettingsDraftDirty, petSettingsMatchesWrite, petSettingsPayload, validatePetCapacityDraft, validatePetSettingsDraft } from "../types/petSettings.types.ts";
import type { PetSettings, PetSettingsDraft, PetSettingsWrite } from "../types/petSettings.types.ts";
import "../styles/petSettings.css";

interface Props { localId: string; registerNavigation?: RegisterPetManagementNavigation }
const emptyDraft = (): PetSettingsDraft => ({ rule: null, value: "" });

export function PetSettingsAdmin({ localId, registerNavigation }: Props) {
  const client = useQueryClient();
  const query = useQuery(petSettingsQuery(localId));
  const [draft, setDraft] = useState<PetSettingsDraft>(() => query.data ? petSettingsDraft(query.data) : emptyDraft());
  const [loaded, setLoaded] = useState<PetSettings | null>(query.data ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<PetSettingsWrite | null>(null);
  const [capacitySaved, setCapacitySaved] = useState<number | null>(query.data?.petConcurrentCapacity ?? null);
  const [capacityDraft, setCapacityDraft] = useState(() => query.data ? String(query.data.petConcurrentCapacity) : "");
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [capacityNotice, setCapacityNotice] = useState<string | null>(null);
  const [capacityUncertain, setCapacityUncertain] = useState<number | null>(null);
  const lock = useRef(false);
  const capacityLock = useRef(false);
  const mutation = useMutation({ mutationFn: petSettingsService.replace, ...petSettingsMutationPolicy() });
  const capacityMutation = useMutation({ mutationFn: petSettingsService.updateCapacity, ...petSettingsMutationPolicy() });

  useEffect(() => {
    if (!query.data || uncertain) return;
    if (loaded && petSettingsDraftDirty(loaded, draft)) return;
    if (loaded && loaded.configured === query.data.configured && loaded.highDemandRule === query.data.highDemandRule
      && loaded.highDemandGapMinutes === query.data.highDemandGapMinutes && loaded.highDemandMaxPerDay === query.data.highDemandMaxPerDay) return;
    setLoaded(query.data);
    setDraft(petSettingsDraft(query.data));
  }, [query.data, uncertain, loaded, draft]);

  useEffect(() => {
    if (!query.data || capacityUncertain !== null || capacitySaved === query.data.petConcurrentCapacity) return;
    if (capacitySaved !== null && capacityDraft !== String(capacitySaved)) return;
    setCapacitySaved(query.data.petConcurrentCapacity);
    setCapacityDraft(String(query.data.petConcurrentCapacity));
  }, [query.data, capacitySaved, capacityDraft, capacityUncertain]);

  const highDemandDirty = loaded !== null && petSettingsDraftDirty(loaded, draft);
  const capacityDirty = capacitySaved !== null && capacityDraft !== String(capacitySaved);
  const dirty = highDemandDirty || capacityDirty;
  const busy = mutation.isPending || capacityMutation.isPending || lock.current || capacityLock.current;

  useEffect(() => {
    if (!registerNavigation) return;
    registerNavigation(createPetSettingsNavigationGuard({ dirty, busy, uncertain: uncertain !== null || capacityUncertain !== null },
      () => window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y salir?")));
    return () => registerNavigation(null);
  }, [registerNavigation, busy, dirty, uncertain, capacityUncertain]);

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
    if (busy) return;
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

  async function acceptCapacity(value: number) {
    setCapacitySaved(value); setCapacityDraft(String(value)); setCapacityUncertain(null); setCapacityError(null);
    await acceptPetCapacity(client, localId, value);
  }
  async function verifyCapacity() {
    if (capacityUncertain === null || busy || !acquirePetSettingsWriteLock(capacityLock)) return;
    try {
      const current = await refresh();
      if (current?.petConcurrentCapacity === capacityUncertain) {
        await acceptCapacity(current.petConcurrentCapacity); setCapacityNotice("La capacidad quedó aplicada según el servidor.");
      } else setCapacityNotice("No pudimos confirmar el cambio. El valor ingresado se conserva; verificá nuevamente.");
    } finally { capacityLock.current = false; }
  }
  async function submitCapacity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !capacityDirty || !acquirePetSettingsWriteLock(capacityLock)) return;
    const validation = validatePetCapacityDraft(capacityDraft);
    setCapacityError(validation);
    if (validation) { capacityLock.current = false; return; }
    const write = petCapacityPayload(capacityDraft)!;
    setCapacityNotice(null);
    try {
      const saved = await capacityMutation.mutateAsync(write);
      await acceptCapacity(saved.petConcurrentCapacity);
      setCapacityNotice("Capacidad guardada.");
    } catch (error: unknown) {
      if (error instanceof PetSettingsApiError && [400, 401, 403].includes(error.status)) {
        setCapacityError(error.status === 400 ? "La capacidad debe ser un entero entre 1 y 10."
          : error.status === 401 ? "Tu sesión venció. Iniciá sesión nuevamente." : "No tenés permiso para cambiar la capacidad.");
      } else {
        const current = await refresh();
        if (current?.petConcurrentCapacity === write.petConcurrentCapacity) {
          await acceptCapacity(current.petConcurrentCapacity); setCapacityNotice("La capacidad quedó aplicada según el servidor.");
        } else {
          setCapacityUncertain(write.petConcurrentCapacity);
          setCapacityNotice("No pudimos confirmar el resultado. El valor se conserva; verificá antes de volver a guardar.");
        }
      }
    } finally { capacityLock.current = false; }
  }

  return <section className="pet-settings" aria-labelledby="pet-settings-title">
    <header className="pet-settings__header"><h1 id="pet-settings-title">Configuración PET</h1><p>Definí la capacidad del local y cómo se organizan los turnos de alta exigencia.</p></header>
    {notice && <p className="pet-settings__notice" role="status">{notice}</p>}
    {query.isLoading ? <p role="status">Cargando configuración…</p> : query.isError ? <div className="pet-settings__message" role="alert"><p>{settingsErrorMessage(query.error)}</p><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div> : <>
      <form className="pet-settings__card" onSubmit={submitCapacity} noValidate>
        <div className="pet-settings__value"><label htmlFor="pet-settings-capacity">Capacidad simultánea de mascotas</label>
          <input id="pet-settings-capacity" type="number" min="1" max="10" step="1" inputMode="numeric" value={capacityDraft}
            aria-describedby="pet-settings-capacity-help pet-settings-capacity-policy" onChange={event => { setCapacityDraft(event.target.value); setCapacityError(null); setCapacityNotice(null); }}
            disabled={busy || capacityUncertain !== null} />
        </div>
        <p id="pet-settings-capacity-help">Cantidad máxima de mascotas que el local puede atender al mismo tiempo.</p>
        <p id="pet-settings-capacity-policy">Los cambios afectan nuevas reservas. Los turnos ya confirmados se conservan.</p>
        {capacityError && <p className="pet-settings__error" role="alert">{capacityError}</p>}
        {capacityNotice && <p className="pet-settings__notice" role="status">{capacityNotice}</p>}
        <button className="pet-settings__primary" type="submit" disabled={busy || capacityUncertain !== null || !capacityDirty}>
          {capacityMutation.isPending ? "Guardando…" : "Guardar capacidad"}</button>
        {capacityUncertain !== null && <button className="pet-settings__secondary" type="button" disabled={busy} onClick={() => void verifyCapacity()}>Verificar capacidad</button>}
      </form>
      {loaded && !loaded.configured && <p className="pet-settings__empty" role="status">Todavía no hay una regla configurada. Elegí una opción para guardar la primera configuración.</p>}
      <form className="pet-settings__card" onSubmit={submit} noValidate>
        <fieldset disabled={busy || uncertain !== null}>
          <legend>Regla para mascotas de alta exigencia</legend>
          <label className="pet-settings__option"><input type="radio" name="high-demand-rule" value="MIN_GAP" checked={draft.rule === "MIN_GAP"} onChange={() => { setDraft({ rule: "MIN_GAP", value: "" }); setFormError(null); setNotice(null); }} /> <span><strong>Separación mínima entre turnos</strong><small>Deja un intervalo de descanso entre turnos de alta exigencia.</small></span></label>
          <label className="pet-settings__option"><input type="radio" name="high-demand-rule" value="MAX_PER_DAY" checked={draft.rule === "MAX_PER_DAY"} onChange={() => { setDraft({ rule: "MAX_PER_DAY", value: "1" }); setFormError(null); setNotice(null); }} /> <span><strong>Solo un turno de alta exigencia por día</strong><small>Permite un único turno de alta exigencia en cada día.</small></span></label>
        </fieldset>
        {draft.rule === "MIN_GAP" && <div className="pet-settings__value"><label htmlFor="pet-settings-value">Separación mínima</label><div className="pet-settings__input"><input id="pet-settings-value" type="number" min="1" step="1" inputMode="numeric" value={draft.value} aria-describedby={formError ? "pet-settings-error" : "pet-settings-unit"} onChange={event => setDraft({ ...draft, value: event.target.value })} disabled={busy || uncertain !== null} /><span id="pet-settings-unit">minutos</span></div></div>}
        {formError && <p id="pet-settings-error" className="pet-settings__error" role="alert">{formError}</p>}
        <button className="pet-settings__primary" type="submit" disabled={busy || uncertain !== null || !draft.rule}>{mutation.isPending ? "Guardando…" : "Guardar configuración"}</button>
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
