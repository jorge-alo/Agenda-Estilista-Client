import { useState } from "react";
import { getAuthHeaders } from "../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  locales: any[];
  onRefresh: () => void;
}

export const LocalesLista = ({ locales, onRefresh }: Props) => {
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null);

  const toggleLocal = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/superadmin/locales/${id}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      onRefresh();
    } catch (error) {
      console.error("Error toggling local:", error);
    }
  };

  const eliminarLocal = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/superadmin/locales/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setConfirmEliminar(null);
      onRefresh();
    } catch (error) {
      console.error("Error eliminando local:", error);
    }
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
                  onClick={() => eliminarLocal(local.id)}
                >
                  Sí, eliminar
                </button>
                <button
                  className="sa-btn"
                  onClick={() => setConfirmEliminar(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-local-acciones">
              <button
                className={`sa-btn ${local.activo ? "bloquear" : "activar"}`}
                onClick={() => toggleLocal(local.id)}
              >
                {local.activo ? "Bloquear" : "Activar"}
              </button>
              <button
                className="sa-btn eliminar"
                onClick={() => setConfirmEliminar(local.id)}
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