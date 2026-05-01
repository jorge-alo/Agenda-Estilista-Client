import {
  useBloqueos
} from "../hooks/useBloqueos";

import "../styles/bloqueos.css";

export const ListaBloqueos = () => {

  const {
    bloqueos,
    eliminarBloqueo
  } = useBloqueos();

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

      {bloqueos.map((b) => {

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
                eliminarBloqueo(b.id)
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