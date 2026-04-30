import type {
  TurnoResumen
} from "../types/dashboard.types";

interface Props {
  turnos: TurnoResumen[];
}

export const ListaTurnosHoy = ({
  turnos
}: Props) => {

  return (

    <div className="dashboard-turnos">

      <div className="dashboard-turnos-header">

        <h2 className="dashboard-turnos-title">
          Turnos del día
        </h2>

      </div>

      {turnos.length === 0 && (

        <div className="turno-row">
          No hay turnos
        </div>

      )}

      {turnos.map(turno => (

        <div
          key={turno.id}
          className="turno-row"
        >

          <div className="turno-hora">
            {turno.hora}
          </div>

          <div className="turno-cliente">

            <span className="turno-nombre">
              {turno.clienteNombre}
            </span>

            <span className="turno-servicio">
              {turno.servicio}
              {" · "}
              {turno.estilista}
            </span>

          </div>

          <div
            className={`
              turno-estado
              ${turno.estado}
            `}
          >
            {turno.estado}
          </div>

        </div>
      ))}

    </div>
  );
};