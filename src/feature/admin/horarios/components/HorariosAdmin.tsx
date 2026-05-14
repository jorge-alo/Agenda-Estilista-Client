import { useState } from "react";

import "../styles/HorariosAdmin.css";

import { dias } from "../constants/dias";

import { useHorarios } from "../hooks/useHorarios";

import { useCrearHorario } from "../mutations/useCrearHorario";

import { useToggleHorario } from "../mutations/useToggleHorario";

interface Props {
  estilistas: any[];

  estilistaId: number | null;

  setEstilistaId:
    (val: any) => void;
}

export const HorariosAdmin =
({
  estilistas,
  estilistaId,
  setEstilistaId,
}: Props) => {

  const [dia, setDia] =
    useState(1);

  const [inicio, setInicio] =
    useState("09:00");

  const [fin, setFin] =
    useState("18:00");

  const {
    data: horarios = [],
    isLoading,
  } = useHorarios(
    estilistaId
  );

  const crearMutation = useCrearHorario();

  const toggleMutation = useToggleHorario( estilistaId || 0 );

  const crear =
    async () => {

      if (!estilistaId) {
        return;
      }

      await crearMutation.mutateAsync({

        estilista_id:
          estilistaId,

        dia_semana:
          dia,

        hora_inicio:
          inicio + ":00",

        hora_fin:
          fin + ":00",
      });
    };

  if (isLoading) {
    return <p>Cargando...</p>;
  }

  return (

    <div>

      <select
        className="hor-admin-select"
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

      {estilistaId && (

        <>

          <div className="hor-admin-label">
            Agregar horario
          </div>

          <div className="hor-admin-form">

            <select
              className="hor-admin-select"
              value={dia}
              onChange={(e) =>
                setDia(
                  Number(e.target.value)
                )
              }
            >

              {dias.map((d, i) => (

                <option
                  key={i}
                  value={i}
                >
                  {d}
                </option>

              ))}

            </select>

            <input
              className="hor-admin-input"
              type="time"
              value={inicio}
              onChange={(e) =>
                setInicio(
                  e.target.value
                )
              }
            />

            <input
              className="hor-admin-input"
              type="time"
              value={fin}
              onChange={(e) =>
                setFin(
                  e.target.value
                )
              }
            />

            <button
              className="hor-admin-btn"
              onClick={crear}
            >
              Agregar horario
            </button>

          </div>

          <div className="hor-admin-label">
            Horarios cargados
          </div>

          <ul className="hor-admin-lista">

            {horarios.map((h: any) => (

              <li
                key={h.id}
                className={`hor-admin-item ${
                  h.activo
                    ? ""
                    : "inactivo"
                }`}
              >

                <div>

                  <div className="hor-admin-item-info">
                    {dias[h.dia_semana]}
                  </div>

                  <div className="hor-admin-item-sub">
                    {h.hora_inicio.slice(0, 5)}
                    {" → "}
                    {h.hora_fin.slice(0, 5)}
                  </div>

                </div>

                <button
                  className={`hor-admin-toggle ${
                    h.activo
                      ? "activo"
                      : "inactivo"
                  }`}
                  onClick={() =>
                    toggleMutation.mutate(
                      h.id
                    )
                  }
                >
                  {h.activo
                    ? "Activo"
                    : "Inactivo"}
                </button>

              </li>
            ))}

          </ul>

        </>
      )}

    </div>
  );
};