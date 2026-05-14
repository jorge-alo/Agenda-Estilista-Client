import { useState } from "react";
import "../styles/EstilistasAdmin.css";
import { ListaBloqueos } from "../../bloqueos/components/BloqueosLista";
import { useEstilistas } from "../hooks/useEstilistas";
import { useCrearEstilista } from "../mutations/useCrearEstilista";
import { EstilistaItem } from "./EstilistaItem";

export const EstilistasAdmin = () => {

  const [nombre, setNombre] =
    useState("");

  const {
    data: estilistas = [],
    isLoading,
  } = useEstilistas();

  const crearMutation = useCrearEstilista();

  const crear = async () => {

    if (!nombre) {
      return;
    }

    await crearMutation.mutateAsync({
      nombre,
    });

    setNombre("");
  };

  if (isLoading) {
    return <p>Cargando...</p>;
  }

  return (

    <div>

      <div className="est-admin-form">

        <input
          className="est-admin-input"
          placeholder="Nombre del estilista"
          value={nombre}
          onChange={(e) =>
            setNombre(e.target.value)
          }
        />

        <button
          className="est-admin-btn"
          onClick={crear}
        >
          Crear
        </button>

      </div>

      <ul className="est-admin-lista">

        {estilistas.map((e) => (

          <EstilistaItem
            key={e.id}
            estilista={e}
          />

        ))}

      </ul>

      <ListaBloqueos />

    </div>
  );
};