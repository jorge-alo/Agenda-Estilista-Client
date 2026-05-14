import { useState } from "react";

import "../styles/ServiciosAdmin.css"

import {
  useServicios
} from "../hooks/useServicios";

import {
  useServiciosPorEstilista
} from "../hooks/useServiciosPorEstilista";

import {
  useCrearServicio
} from "../mutations/useCrearServicio";

import {
  useEliminarServicio
} from "../mutations/useEliminarServicio";

import {
  useToggleServicio
} from "../mutations/useToggleServicio";

import {
  useAsignarServicio
} from "../mutations/useAsignarServicio";

import {
  useDesasignarServicio
} from "../mutations/useDesasignarServicio";

interface Props {
  estilistas: any[];
  estilistaId: number | null;
  setEstilistaId: (val: any) => void;
}

export const ServiciosAdmin =
({
  estilistas,
  estilistaId,
  setEstilistaId,
}: Props) => {

  const [servicioId, setServicioId] =
    useState<number | null>(null);

  const [nombre, setNombre] =
    useState("");

  const [duracion, setDuracion] =
    useState<number>(30);

  const [precio, setPrecio] =
    useState<number>(0);

  // QUERIES

  const {
    data: servicios = [],
    isLoading,
  } = useServicios();

  const {
    data: serviciosAsignados = [],
  } = useServiciosPorEstilista(
    estilistaId
  );

  // MUTATIONS

  const crearMutation =
    useCrearServicio();

  const eliminarMutation =
    useEliminarServicio();

  const toggleMutation =
    useToggleServicio();

  const asignarMutation =
    useAsignarServicio();

  const desasignarMutation =
    useDesasignarServicio();

  // HANDLERS

  const crearServicio =
    async () => {

      if (!nombre || !duracion) {
        return;
      }

      await crearMutation.mutateAsync({
        nombre,
        duracion,
        precio,
      });

      setNombre("");
      setDuracion(30);
      setPrecio(0);
    };

  const handleAsignar =
    async () => {

      if (
        !estilistaId ||
        !servicioId
      ) {
        return;
      }

      await asignarMutation.mutateAsync({
        estilista_id: estilistaId,
        servicio_id: servicioId,
      });

      setServicioId(null);
    };

  const handleDesasignar =
    async (
      servicio_id: number
    ) => {

      if (!estilistaId) {
        return;
      }

      await desasignarMutation.mutateAsync({
        estilista_id: estilistaId,
        servicio_id,
      });
    };

  if (isLoading) {
    return <p>Cargando servicios...</p>;
  }
console.log("Estilistas",estilistas);
  return (
    <div>

      <div className="srv-admin-label">
        Crear servicio
      </div>

      <div className="srv-admin-form">

        <input
          className="srv-admin-input"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) =>
            setNombre(
              e.target.value
            )
          }
        />

        <input
          className="srv-admin-input"
          type="number"
          placeholder="Duración"
          value={duracion}
          onChange={(e) =>
            setDuracion(
              Number(e.target.value)
            )
          }
        />

        <input
          className="srv-admin-input"
          type="number"
          placeholder="Precio"
          value={precio}
          onChange={(e) =>
            setPrecio(
              Number(e.target.value)
            )
          }
        />

        <button
          className="srv-admin-btn"
          onClick={crearServicio}
        >
          Crear
        </button>

      </div>

      <div className="srv-admin-divider" />

      {servicios.length > 0 && (

        <ul className="srv-admin-lista">

          {servicios.map((s: any) => (

            <li
              key={s.id}
              className="srv-admin-item"
            >

              <div>

                <div className="srv-admin-item-info">
                  {s.nombre}
                </div>

                <div className="srv-admin-item-sub">
                  {s.duracion}min · ${s.precio}
                </div>

              </div>

              <div className="srv-admin-item-acciones">

                <button
                  className="srv-admin-item-btn"
                  onClick={() =>
                    toggleMutation.mutate(
                      s.id
                    )
                  }
                >
                  {s.activo
                    ? "Activo"
                    : "Inactivo"}
                </button>

                <button
                  className="srv-admin-item-btn danger"
                  onClick={() =>
                    eliminarMutation.mutate(
                      s.id
                    )
                  }
                >
                  Eliminar
                </button>

              </div>

            </li>
          ))}

        </ul>
      )}

      <div className="srv-admin-label">
        Asignar a estilista
      </div>

      <select
        className="srv-admin-select"
        value={estilistaId ?? ""}
        onChange={(e) =>
          setEstilistaId(
            e.target.value
              ? Number(e.target.value)
              : null
          )
        }
      >

        <option value="">
          Seleccionar estilista
        </option>

        {estilistas.map((e: any) => (

          <option
            key={e.id}
            value={e.id}
          >
            {e.nombre}
          </option>

        ))}

      </select>

      <select
        className="srv-admin-select"
        value={servicioId ?? ""}
        onChange={(e) =>
          setServicioId(
            e.target.value
              ? Number(e.target.value)
              : null
          )
        }
      >

        <option value="">
          Seleccionar servicio
        </option>

        {servicios.map((s: any) => (

          <option
            key={s.id}
            value={s.id}
          >
            {s.nombre} · ${s.precio}
          </option>

        ))}

      </select>

      <button
        className="srv-admin-btn"
        onClick={handleAsignar}
      >
        Asignar
      </button>

      {serviciosAsignados.length > 0 && (

        <>

          <div className="srv-admin-divider" />

          <div className="srv-admin-label">
            Servicios del estilista
          </div>

          <ul className="srv-admin-lista">

            {serviciosAsignados.map((s: any) => (

              <li
                key={s.id}
                className="srv-admin-item"
              >

                <div>

                  <div className="srv-admin-item-info">
                    {s.nombre}
                  </div>

                  <div className="srv-admin-item-sub">
                    {s.duracion}min · ${s.precio}
                  </div>

                </div>

                <button
                  className="srv-admin-item-btn danger"
                  onClick={() =>
                    handleDesasignar(
                      s.id
                    )
                  }
                >
                  Quitar
                </button>

              </li>
            ))}

          </ul>

        </>
      )}

    </div>
  );
};