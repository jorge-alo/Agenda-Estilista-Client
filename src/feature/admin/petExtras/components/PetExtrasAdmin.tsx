import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { petExtrasService } from "../services/petExtras.service.ts";
import { petExtraMutationPolicy, petExtraWriteWithRecovery, petExtrasQuery } from "../queries/petExtrasQueries.ts";
import { acquirePetExtraWriteLock, releasePetExtraWriteLock } from "../queries/petExtraWriteLock.ts";
import { validatePetExtraNombre } from "../types/petExtras.types.ts";
import type { PetExtra } from "../types/petExtras.types.ts";
import { petExtraStatus, petExtrasCatalogState, petExtrasErrorMessage } from "./petExtrasView.ts";
import "../styles/petExtras.css";

interface Props { localId: string }

export function PetExtrasAdmin({ localId }: Props) {
  const client = useQueryClient();
  const query = useQuery(petExtrasQuery(localId));
  const key = petExtrasQuery(localId).queryKey;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);

  const createMutation = useMutation({
    mutationFn: (nombre: string) => petExtrasService.createPetExtra({ nombre }),
    ...petExtraMutationPolicy(),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { nombre: string } | { activo: boolean } }) =>
      petExtrasService.updatePetExtra(id, payload),
    ...petExtraMutationPolicy(),
  });
  const busy = createMutation.isPending || patchMutation.isPending;
  const catalogState = petExtrasCatalogState({ isLoading: query.isLoading, isError: query.isError, data: query.data });

  async function refreshCatalog(): Promise<boolean> {
    try {
      await client.fetchQuery({ ...petExtrasQuery(localId), staleTime: 0 });
      return true;
    } catch { return false; }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acquirePetExtraWriteLock(lock)) return;
    const error = validatePetExtraNombre(newName);
    setNewError(error);
    if (error) { releasePetExtraWriteLock(lock); return; }
    setNotice(null);
    try {
      const result = await petExtraWriteWithRecovery(
        () => createMutation.mutateAsync(newName.trim()), refreshCatalog,
      );
      if (result.kind === "success") {
        await client.invalidateQueries({ queryKey: key });
        setNewName("");
        setCreating(false);
        setNewError(null);
        setNotice("Extra creado.");
        toast.success("Extra creado.");
      } else if (result.kind === "uncertain") {
        const message = "No pudimos confirmar si el extra se creó. Revisá la lista antes de intentarlo nuevamente.";
        setNotice(result.refreshed ? message : `${message} No pudimos actualizar el catálogo ahora.`);
      } else {
        setNewError(petExtrasErrorMessage(result.error));
      }
    } finally { releasePetExtraWriteLock(lock); }
  }

  function beginEdit(extra: PetExtra) {
    setEditingId(extra.id);
    setEditName(extra.nombre);
    setEditError(null);
    setNotice(null);
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>, extraId: number) {
    event.preventDefault();
    if (!acquirePetExtraWriteLock(lock)) return;
    const error = validatePetExtraNombre(editName);
    setEditError(error);
    if (error) { releasePetExtraWriteLock(lock); return; }
    setNotice(null);
    try {
      const result = await petExtraWriteWithRecovery(
        () => patchMutation.mutateAsync({ id: extraId, payload: { nombre: editName.trim() } }), refreshCatalog,
      );
      if (result.kind === "success") {
        await client.invalidateQueries({ queryKey: key });
        setEditingId(null);
        setEditError(null);
        setNotice("Nombre actualizado.");
        toast.success("Nombre actualizado.");
      } else if (result.kind === "not-found") {
        setEditingId(null);
        setEditError(null);
        setNotice(petExtrasErrorMessage(result.error));
      } else if (result.kind === "uncertain") {
        setNotice(result.refreshed
          ? "No pudimos confirmar el cambio. El catálogo se actualizó con el estado actual del servidor."
          : "No pudimos confirmar el cambio ni actualizar el catálogo. Revisá el estado antes de volver a editar.");
      } else setEditError(petExtrasErrorMessage(result.error));
    } finally { releasePetExtraWriteLock(lock); }
  }

  async function changeStatus(extra: PetExtra) {
    if (lock.current || busy) return;
    const nextActivo = extra.activo !== 1;
    if (!nextActivo && !window.confirm("¿Desactivar este extra? No se elimina y podés reactivarlo después.")) return;
    if (!acquirePetExtraWriteLock(lock)) return;
    setNotice(null);
    try {
      const result = await petExtraWriteWithRecovery(
        () => patchMutation.mutateAsync({ id: extra.id, payload: { activo: nextActivo } }), refreshCatalog,
      );
      if (result.kind === "success") {
        await client.invalidateQueries({ queryKey: key });
        setNotice(nextActivo ? "Extra activado." : "Extra desactivado. No se eliminó y podés reactivarlo después.");
        toast.success(nextActivo ? "Extra activado." : "Extra desactivado.");
      } else if (result.kind === "not-found") {
        if (editingId === extra.id) setEditingId(null);
        setNotice(petExtrasErrorMessage(result.error));
      } else if (result.kind === "uncertain") {
        setNotice(result.refreshed
          ? "No pudimos confirmar el estado. El catálogo se actualizó con el estado actual del servidor."
          : "No pudimos confirmar el estado ni actualizar el catálogo. Revisá el estado antes de volver a intentarlo.");
      } else setNotice(petExtrasErrorMessage(result.error));
    } finally { releasePetExtraWriteLock(lock); }
  }

  return (
    <section className="pet-extras" aria-labelledby="pet-extras-title">
      <header className="pet-extras__header">
        <div>
          <h1 id="pet-extras-title">Extras</h1>
          <p>Administrá el catálogo de extras de tu local.</p>
        </div>
        <button className="pet-extras__primary" type="button" onClick={() => { setCreating(true); setNewError(null); setNotice(null); }} disabled={busy || creating}>
          + Nuevo extra
        </button>
      </header>

      {notice && <p className="pet-extras__notice" role="status">{notice}</p>}

      {creating && (
        <form className="pet-extras__form" onSubmit={submitCreate} noValidate>
          <label htmlFor="pet-extras-new-name">Nombre del extra</label>
          <input id="pet-extras-new-name" value={newName} maxLength={201} onChange={event => { setNewName(event.target.value); setNewError(null); }} aria-invalid={Boolean(newError)} aria-describedby={newError ? "pet-extras-new-error" : undefined} disabled={busy} autoFocus />
          {newError && <p className="pet-extras__error" id="pet-extras-new-error" role="alert">{newError}</p>}
          {createMutation.isPending && <p className="pet-extras__hint" role="status">Creando extra…</p>}
          <div className="pet-extras__actions">
            <button className="pet-extras__primary" type="submit" disabled={busy}>Crear extra</button>
            <button className="pet-extras__secondary" type="button" disabled={busy} onClick={() => { setCreating(false); setNewName(""); setNewError(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {catalogState === "loading" ? <p className="pet-extras__loading" role="status">Cargando extras…</p>
        : catalogState === "error" ? <div className="pet-extras__message" role="alert"><p>{petExtrasErrorMessage(query.error)}</p><button className="pet-extras__secondary" type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div>
          : catalogState === "empty" ? <div className="pet-extras__empty"><h2>Todavía no hay extras.</h2><p>Creá el primero para empezar a configurar opciones adicionales.</p><button className="pet-extras__primary" type="button" onClick={() => { setCreating(true); setNewError(null); }} disabled={creating || busy}>Crear primer extra</button></div>
            : <ul className="pet-extras__list">
              {query.data?.map(extra => {
                const editing = editingId === extra.id;
                const itemBusy = busy && (patchMutation.variables?.id === extra.id || createMutation.isPending);
                const status = petExtraStatus(extra.activo);
                return <li className="pet-extras__item" key={extra.id}>
                  <div className="pet-extras__item-main">
                    {editing ? <form className="pet-extras__edit" onSubmit={event => void submitEdit(event, extra.id)} noValidate>
                      <label htmlFor={`pet-extra-name-${extra.id}`}>Nombre del extra</label>
                      <input id={`pet-extra-name-${extra.id}`} value={editName} maxLength={201} onChange={event => { setEditName(event.target.value); setEditError(null); }} aria-invalid={Boolean(editError)} aria-describedby={editError ? `pet-extra-error-${extra.id}` : undefined} disabled={busy} />
                      {editError && <p className="pet-extras__error" id={`pet-extra-error-${extra.id}`} role="alert">{editError}</p>}
                      <div className="pet-extras__actions"><button className="pet-extras__primary" type="submit" disabled={busy}>Guardar</button><button className="pet-extras__secondary" type="button" disabled={busy} onClick={() => { setEditingId(null); setEditError(null); }}>Cancelar</button></div>
                    </form> : <strong className="pet-extras__name">{extra.nombre}</strong>}
                    <span className={`pet-extras__status${extra.activo === 1 ? "" : " is-inactive"}`}>{status.label}</span>
                  </div>
                  {!editing && <div className="pet-extras__actions">
                    <button className="pet-extras__secondary" type="button" onClick={() => beginEdit(extra)} disabled={busy || query.isFetching}>Editar</button>
                    <button className="pet-extras__secondary" type="button" onClick={() => void changeStatus(extra)} disabled={busy || query.isFetching || itemBusy}>{status.action}</button>
                  </div>}
                </li>;
              })}
            </ul>}
    </section>
  );
}
