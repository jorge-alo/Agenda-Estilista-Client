import { useState } from "react";
import type {
  Estilista
} from "../types/estilistas.types";

interface Props {
  estilista: Estilista;
  onUpdate: (id: number, nombre: string) => void;
  onDelete: (id: number) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export const EstilistaItem =
  ({
    estilista,
    onUpdate,
    onDelete,
    isUpdating,
    isDeleting,
  }: Props) => {

    const [editNombre, setEditNombre] = useState(estilista.nombre);
    const [isEditing, setIsEditing] = useState(false);

    const iniciales =
      estilista.nombre
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const handleSave = () => {
      if (editNombre.trim() && editNombre !== estilista.nombre) {
        onUpdate(estilista.id, editNombre.trim());
        setIsEditing(false);
      } else {
        setEditNombre(estilista.nombre);
        setIsEditing(false);
      }
    };

    const handleCancel = () => {
      setEditNombre(estilista.nombre);
      setIsEditing(false);
    };

    const handleDelete = () => {
      if (window.confirm(`¿Estás seguro de eliminar a ${estilista.nombre}?`)) {
        onDelete(estilista.id);
      }
    };

    const isLoading = isUpdating || isDeleting;

    return (
    <li className="est-admin-item">
      <div className="est-admin-item-avatar">{iniciales}</div>

      {isEditing ? (
        <div className="est-admin-item-edit">
          <input
            className="est-admin-edit-input"
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            disabled={isLoading}
          />
          <button 
            className="est-admin-btn-small est-admin-btn-save" 
            onClick={handleSave} 
            disabled={isLoading || !editNombre.trim()}
          >
            {isLoading ? "..." : "Guardar"}
          </button>
          <button 
            className="est-admin-btn-small est-admin-btn-cancel" 
            onClick={handleCancel} 
            disabled={isLoading}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <span className="est-admin-item-name">{estilista.nombre}</span>
          <div className="est-admin-item-actions">
            <button
              className="est-admin-icon-btn est-admin-icon-btn-edit"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              title="Editar"
            >
              ✏️
            </button>
            <button
              className="est-admin-icon-btn est-admin-icon-btn-delete"
              onClick={handleDelete}
              disabled={isLoading}
              title="Eliminar"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </li>
  );
  };