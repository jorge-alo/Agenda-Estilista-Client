import {
  useReporteMensual
} from "../hooks/useReporteMensual";

export const ReporteMensual = () => {

  const {
    data,
    loading
  } = useReporteMensual();

  if (loading) {
    return <p>Cargando...</p>;
  }

  if (!data) {
    return null;
  }

  return (

    <div className="dashboard-reporte">

      <div className="dashboard-section-header">

        <h2 className="dashboard-section-title">
          Reporte mensual
        </h2>

      </div>

      <div className="dashboard-reporte-grid">

        <div className="dashboard-reporte-card">
          <span>Ingresos</span>

          <strong>
            ${data.ingresos}
          </strong>
        </div>

        <div className="dashboard-reporte-card">
          <span>Turnos</span>

          <strong>
            {data.turnos}
          </strong>
        </div>

        <div className="dashboard-reporte-card">
          <span>Cancelaciones</span>

          <strong>
            {data.cancelaciones}
          </strong>
        </div>

        <div className="dashboard-reporte-card">
          <span>Servicio top</span>

          <strong>
            {data.servicioTop}
          </strong>
        </div>

        <div className="dashboard-reporte-card">
          <span>Estilista top</span>

          <strong>
            {data.estilistaTop}
          </strong>
        </div>

      </div>

    </div>
  );
};