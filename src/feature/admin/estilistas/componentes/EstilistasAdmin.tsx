import { useState } from "react";
import "../styles/EstilistasAdmin.css";
import { ListaBloqueos } from "../../bloqueos/components/BloqueosLista";
import { useEstilistas } from "../hooks/useEstilistas";
import { useCrearEstilista } from "../mutations/useCrearEstilista";

import { EstilistaItem } from "./EstilistaItem";
import { EstilistasSkeleton } from "./EstilistasSkeleton";
import { useActualizarEstilista } from "../hooks/useActualizarEstilista";
import { useEliminarEstilista } from "../hooks/useEliminarEstilista";

export const EstilistasAdmin = () => {
  const [nombre, setNombre] = useState("");

  const { data: estilistas = [], isLoading } = useEstilistas();
  const crearMutation = useCrearEstilista();
  const actualizarMutation = useActualizarEstilista();
  const eliminarMutation = useEliminarEstilista();

  const crear = async () => {
    if (!nombre.trim()) return;
    await crearMutation.mutateAsync({ nombre: nombre.trim() });
    setNombre("");
  };

  return (
    <div>
      <div className="est-admin-form">
        <input
          className="est-admin-input"
          placeholder="Nombre del nuevo estilista"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          disabled={crearMutation.isPending}
        />
        <button 
          className="est-admin-btn" 
          onClick={crear}
          disabled={crearMutation.isPending || !nombre.trim()}
        >
          {crearMutation.isPending ? "Creando..." : "Crear"}
        </button>
      </div>

      {isLoading ? (
        <EstilistasSkeleton />
      ) : (
        <ul className="est-admin-lista">
          {estilistas.map((e) => (
            <EstilistaItem
              key={e.id}
              estilista={e}
              onUpdate={(id, nuevoNombre) =>
                actualizarMutation.mutate({ id, nombre: nuevoNombre })
              }
              onDelete={(id) => eliminarMutation.mutate(id)}
              isUpdating={actualizarMutation.isPending && actualizarMutation.variables?.id === e.id}
              isDeleting={eliminarMutation.isPending && eliminarMutation.variables === e.id}
            />
          ))}
        </ul>
      )}

      <ListaBloqueos />
    </div>
  );
};