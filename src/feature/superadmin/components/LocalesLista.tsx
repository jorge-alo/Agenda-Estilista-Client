import { useState } from "react";
import type { Local } from "../types/superadmin.types";
import { useToggleLocal, useEliminarLocal } from "../mutations/useGestionarLocal";

interface Props {
  locales: Local[];
}

export const LocalesLista = ({ locales }: Props) => {
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);

  const toggleMutation = useToggleLocal();
  const deleteMutation = useEliminarLocal();

  const handleToggle = (id: number) => {
    toggleMutation.mutate(id);
  };

  const handleEliminar = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setConfirmEliminar(null),
    });
  };

  if (locales.length === 0) {
    return <p className="sa-empty">No hay locales registrados</p>;
  }

  return (
    <div className="sa-lista">
      {locales.map((local) => (
        <div key={local.id} className={`sa-local ${!local.activo ? "bloqueado" : ""}`}>
          <div className="sa-local-header">
            <div>
              <span className="sa-local-nombre">{local.nombre}</span>
              <span className={`sa-badge ${local.activo ? "activo" : "inactivo"}`}>
                {local.activo ? "Activo" : "Bloqueado"}
              </span>
            </div>
            <span className="sa-local-fecha">
              {new Date(local.created_at).toLocaleDateString("es-AR")}
            </span>
          </div>

          <div className="sa-local-info">
            <span>📧 {local.email}</span>
            <span>📞 {local.telefono || "—"}</span>
          </div>

          {confirmEliminar === local.id ? (
            <div className="sa-confirm">
              <span>¿Seguro que querés eliminar este local?</span>
              <div className="sa-confirm-btns">
                <button
                  className="sa-btn eliminar"
                  onClick={() => handleEliminar(local.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  className="sa-btn"
                  onClick={() => setConfirmEliminar(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-local-acciones">
              <button
                className={`sa-btn ${local.activo ? "bloquear" : "activar"}`}
                onClick={() => handleToggle(local.id)}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending && toggleMutation.variables === local.id 
                  ? "Procesando..." 
                  : (local.activo ? "Bloquear" : "Activar")}
              </button>
              <button
                className="sa-btn eliminar"
                onClick={() => setConfirmEliminar(local.id)}
                disabled={toggleMutation.isPending}
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};