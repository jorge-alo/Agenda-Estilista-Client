import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { petServiciosService } from "../services/petServicios.service.ts";
import { petServicioMutationPolicy, petServiciosQuery, petServicioWriteWithRecovery } from "../queries/petServiciosQueries.ts";
import { validatePetServicioNombre } from "../types/petServicios.types.ts";
import type { PetServicio } from "../types/petServicios.types.ts";
import { petServicioStatus, petServiciosCatalogState, petServiciosErrorMessage } from "./petServiciosView.ts";
import "../styles/petServicios.css";

interface Props { localId: string }

export function PetServiciosAdmin({ localId }: Props) {
  const client = useQueryClient();
  const query = useQuery(petServiciosQuery(localId));
  const key = petServiciosQuery(localId).queryKey;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);

  const createMutation = useMutation({
    mutationFn: (nombre: string) => petServiciosService.createPetServicio({ nombre }),
    ...petServicioMutationPolicy(),
  });
  const patchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { nombre: string } | { activo: boolean } }) =>
      petServiciosService.updatePetServicio(id, payload),
    ...petServicioMutationPolicy(),
  });
  const busy = createMutation.isPending || patchMutation.isPending;
  const catalogState = petServiciosCatalogState({ isLoading: query.isLoading, isError: query.isError, data: query.data });

  async function refreshCatalog(): Promise<boolean> {
    try {
      await client.fetchQuery({ ...petServiciosQuery(localId), staleTime: 0 });
      return true;
    } catch { return false; }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const error = validatePetServicioNombre(newName);
    setNewError(error);
    if (error) return;
    lock.current = true;
    setNotice(null);
    try {
      const result = await petServicioWriteWithRecovery(
        () => createMutation.mutateAsync(newName.trim()), refreshCatalog,
      );
      if (result.kind === "success") {
        await client.invalidateQueries({ queryKey: key });
        setNewName("");
        setCreating(false);
        setNewError(null);
        setNotice("Servicio creado.");
        toast.success("Servicio creado.");
      } else if (result.kind === "uncertain") {
        const message = "No pudimos confirmar si el servicio se creó. Revisá la lista antes de intentarlo nuevamente.";
        setNotice(result.refreshed ? message : `${message} No pudimos actualizar el catálogo ahora.`);
      } else {
        setNewError(petServiciosErrorMessage(result.error));
      }
    } finally { lock.current = false; }
  }

  function beginEdit(servicio: PetServicio) {
    setEditingId(servicio.id);
    setEditName(servicio.nombre);
    setEditError(null);
    setNotice(null);
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>, servicioId: number) {
    event.preventDefault();
    if (lock.current) return;
    const error = validatePetServicioNombre(editName);
    setEditError(error);
    if (error) return;
    lock.current = true;
    setNotice(null);
    try {
      const result = await petServicioWriteWithRecovery(
        () => patchMutation.mutateAsync({ id: servicioId, payload: { nombre: editName.trim() } }), refreshCatalog,
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
        setNotice(petServiciosErrorMessage(result.error));
      } else if (result.kind === "uncertain") {
        setNotice(result.refreshed
          ? "No pudimos confirmar el cambio. El catálogo se actualizó con el estado actual del servidor."
          : "No pudimos confirmar el cambio ni actualizar el catálogo. Revisá el estado antes de volver a editar.");
      } else setEditError(petServiciosErrorMessage(result.error));
    } finally { lock.current = false; }
  }

  async function changeStatus(servicio: PetServicio) {
    if (lock.current || busy) return;
    const nextActivo = servicio.activo !== 1;
    if (!nextActivo && !window.confirm("¿Desactivar este servicio? No se elimina y podés reactivarlo después.")) return;
    lock.current = true;
    setNotice(null);
    try {
      const result = await petServicioWriteWithRecovery(
        () => patchMutation.mutateAsync({ id: servicio.id, payload: { activo: nextActivo } }), refreshCatalog,
      );
      if (result.kind === "success") {
        await client.invalidateQueries({ queryKey: key });
        setNotice(nextActivo ? "Servicio activado." : "Servicio desactivado. No se eliminó y podés reactivarlo después.");
        toast.success(nextActivo ? "Servicio activado." : "Servicio desactivado.");
      } else if (result.kind === "not-found") {
        if (editingId === servicio.id) setEditingId(null);
        setNotice(petServiciosErrorMessage(result.error));
      } else if (result.kind === "uncertain") {
        setNotice(result.refreshed
          ? "No pudimos confirmar el estado. El catálogo se actualizó con el estado actual del servidor."
          : "No pudimos confirmar el estado ni actualizar el catálogo. Revisá el estado antes de volver a intentarlo.");
      } else setNotice(petServiciosErrorMessage(result.error));
    } finally { lock.current = false; }
  }

  return (
    <section className="pet-servicios" aria-labelledby="pet-servicios-title">
      <header className="pet-servicios__header">
        <div>
          <h1 id="pet-servicios-title">Servicios</h1>
          <p>Administrá el catálogo de servicios de tu local.</p>
        </div>
        <button className="pet-servicios__primary" type="button" onClick={() => { setCreating(true); setNewError(null); setNotice(null); }} disabled={busy || creating}>
          + Nuevo servicio
        </button>
      </header>

      {notice && <p className="pet-servicios__notice" role="status">{notice}</p>}

      {creating && (
        <form className="pet-servicios__form" onSubmit={submitCreate} noValidate>
          <label htmlFor="pet-servicios-new-name">Nombre del servicio</label>
          <input id="pet-servicios-new-name" value={newName} maxLength={101} onChange={event => { setNewName(event.target.value); setNewError(null); }} aria-invalid={Boolean(newError)} aria-describedby={newError ? "pet-servicios-new-error" : undefined} disabled={busy} autoFocus />
          {newError && <p className="pet-servicios__error" id="pet-servicios-new-error" role="alert">{newError}</p>}
          {createMutation.isPending && <p className="pet-servicios__hint" role="status">Creando servicio…</p>}
          <div className="pet-servicios__actions">
            <button className="pet-servicios__primary" type="submit" disabled={busy}>Crear servicio</button>
            <button className="pet-servicios__secondary" type="button" disabled={busy} onClick={() => { setCreating(false); setNewName(""); setNewError(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {catalogState === "loading" ? <p className="pet-servicios__loading" role="status">Cargando servicios…</p>
        : catalogState === "error" ? <div className="pet-servicios__message" role="alert"><p>{petServiciosErrorMessage(query.error)}</p><button className="pet-servicios__secondary" type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Reintentar</button></div>
          : catalogState === "empty" ? <div className="pet-servicios__empty"><h2>Todavía no hay servicios</h2><p>Creá el primero para comenzar a configurar el catálogo.</p><button className="pet-servicios__primary" type="button" onClick={() => setCreating(true)} disabled={creating || busy}>Crear primer servicio</button></div>
            : <ul className="pet-servicios__list">
              {query.data?.map(servicio => {
                const editing = editingId === servicio.id;
                const itemBusy = busy && (patchMutation.variables?.id === servicio.id || createMutation.isPending);
                const status = petServicioStatus(servicio.activo);
                return <li className="pet-servicios__item" key={servicio.id}>
                  <div className="pet-servicios__item-main">
                    {editing ? <form className="pet-servicios__edit" onSubmit={event => void submitEdit(event, servicio.id)} noValidate>
                      <label htmlFor={`pet-servicio-name-${servicio.id}`}>Nombre del servicio</label>
                      <input id={`pet-servicio-name-${servicio.id}`} value={editName} maxLength={101} onChange={event => { setEditName(event.target.value); setEditError(null); }} aria-invalid={Boolean(editError)} aria-describedby={editError ? `pet-servicio-error-${servicio.id}` : undefined} disabled={busy} />
                      {editError && <p className="pet-servicios__error" id={`pet-servicio-error-${servicio.id}`} role="alert">{editError}</p>}
                      <div className="pet-servicios__actions"><button className="pet-servicios__primary" type="submit" disabled={busy}>Guardar</button><button className="pet-servicios__secondary" type="button" disabled={busy} onClick={() => { setEditingId(null); setEditError(null); }}>Cancelar</button></div>
                    </form> : <strong className="pet-servicios__name">{servicio.nombre}</strong>}
                    <span className={`pet-servicios__status${servicio.activo === 1 ? "" : " is-inactive"}`}>{status.label}</span>
                  </div>
                  {!editing && <div className="pet-servicios__actions">
                    <button className="pet-servicios__secondary" type="button" onClick={() => beginEdit(servicio)} disabled={busy || query.isFetching}>Editar</button>
                    <button className="pet-servicios__secondary" type="button" onClick={() => void changeStatus(servicio)} disabled={busy || query.isFetching || itemBusy}>{status.action}</button>
                  </div>}
                </li>;
              })}
            </ul>}
    </section>
  );
}
