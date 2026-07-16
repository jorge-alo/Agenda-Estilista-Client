import {
  useBloqueos
} from "../hooks/useBloqueos";

import {
  useEliminarBloqueo
} from "../mutations/useEliminarBloqueo";

import "../styles/bloqueos.css";
import type { Bloqueo } from "../types/bloqueos.types";
import { BloqueosSkeleton } from "./BloqueosSkeleton";

export const ListaBloqueos = () => {

  const {
    data: bloqueos = [],
    isLoading,
  } = useBloqueos();

  const eliminarMutation =
    useEliminarBloqueo();

    if (isLoading) {
    return <BloqueosSkeleton />;
  }

  if (!bloqueos.length) {
    return (
      <p>
        No hay bloqueos cargados
      </p>
    );
  }

  return (

    <div className="bloqueos-list">

      <h2>
        Bloqueos activos
      </h2>

      {bloqueos.map((b: Bloqueo) => {

        const esDiaCompleto =
          b.hora_inicio === "00:00:00" &&
          b.hora_fin === "23:59:00";

        return (

          <div
            key={b.id}
            className="bloqueo-card"
          >

            <div>

              <h3>
                {b.estilista_nombre}
              </h3>

              <p>
                📅 {b.fecha}
              </p>

              <p>

                {esDiaCompleto
                  ? "🔒 Día completo"
                  : `⏰ ${b.hora_inicio} - ${b.hora_fin}`}

              </p>

              {b.motivo && (

                <p>
                  📝 {b.motivo}
                </p>

              )}

            </div>

            <button
              onClick={() =>
                eliminarMutation.mutate(
                  b.id
                )
              }

              disabled={
                eliminarMutation.isPending
              }
            >
              Eliminar
            </button>

          </div>

        );
      })}

    </div>
  );
};