interface EstilistaResumen {
  nombre: string;
  iniciales: string;
  cantidad: number;
}

interface Props {
  estilistas: EstilistaResumen[];
}

export const PorEstilista = ({
  estilistas
}: Props) => {

  return (

    <div className="dashboard-estilistas">

      <div className="dashboard-section-header">

        <h2 className="dashboard-section-title">
          Rendimiento por estilista
        </h2>

      </div>

      <div className="dashboard-estilistas-grid">

        {estilistas.map(estilista => (

          <div
            key={estilista.nombre}
            className="dashboard-estilista-card"
          >

            <div className="dashboard-estilista-avatar">
              {estilista.iniciales}
            </div>

            <div className="dashboard-estilista-info">

              <span className="dashboard-estilista-nombre">
                {estilista.nombre}
              </span>

              <span className="dashboard-estilista-turnos">
                {estilista.cantidad} turnos
              </span>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
};