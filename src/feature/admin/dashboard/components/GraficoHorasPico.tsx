interface HoraData {
  hora: string;
  reservados: number;
}

interface Props {
  data: HoraData[];
}

export const GraficoHorasPico = ({
  data
}: Props) => {

  const maximo = Math.max(
    ...data.map(item => item.reservados),
    1
  );

  return (

    <div className="dashboard-grafico">

      <div className="dashboard-section-header">

        <h2 className="dashboard-section-title">
          Horas pico
        </h2>

      </div>

      <div className="grafico-barras">

        {data.length === 0 && (
          <p className="dashboard-empty">
            No hay datos para mostrar
          </p>
        )}

        {data.map(item => {

          const width =
            (item.reservados / maximo) * 100;

          return (

            <div
              key={item.hora}
              className="grafico-row"
            >

              <span className="grafico-hora">
                {item.hora}
              </span>

              <div className="grafico-barra-container">

                <div
                  className="grafico-barra"
                  style={{
                    width: `${width}%`
                  }}
                />

              </div>

              <span className="grafico-numero">
                {item.reservados}
              </span>

            </div>
          );
        })}

      </div>

    </div>
  );
};