
import { Skeleton } from "../../../../shared/ui/Skeleton";
import "../styles/dashboard.css";

export const DashboardSkeleton = () => {
  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <div className="dashboard-header">
        <Skeleton width="180px" height="32px" />
        <Skeleton width="120px" height="13px" />
      </div>

      {/* RESUMEN DEL DÍA */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <Skeleton width="200px" height="26px" />
        </div>

        <div className="dashboard-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dashboard-card">
              <Skeleton width="60%" height="12px" className="mb-12" />
              <Skeleton width="50%" height="30px" />
            </div>
          ))}
        </div>

        {/* POR ESTILISTA */}
        <div className="dashboard-estilistas" style={{ marginTop: "14px" }}>
          <div className="dashboard-estilistas-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="dashboard-estilista-card">
                <Skeleton width="48px" height="48px" radius="50%" />
                <div className="dashboard-estilista-info" style={{ gap: "6px" }}>
                  <Skeleton width="90px" height="14px" />
                  <Skeleton width="60px" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TURNOS DEL DÍA */}
        <div className="dashboard-turnos" style={{ marginTop: "14px" }}>
          <div className="dashboard-turnos-header">
            <Skeleton width="140px" height="24px" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="turno-row">
              <Skeleton width="50px" height="14px" />
              <div className="turno-cliente" style={{ gap: "6px" }}>
                <Skeleton width="100px" height="14px" />
                <Skeleton width="70px" height="12px" />
              </div>
              <Skeleton width="70px" height="22px" radius="999px" />
            </div>
          ))}
        </div>
      </section>

      {/* CLIENTES */}
      <section className="dashboard-section">
        <div className="dashboard-clientes">
          <div className="dashboard-section-header">
            <Skeleton width="220px" height="26px" />
          </div>
          <div className="dashboard-clientes-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="dashboard-cliente-card">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <Skeleton width="120px" height="14px" />
                  <Skeleton width="90px" height="12px" />
                </div>
                <div className="dashboard-cliente-info">
                  <Skeleton width="60px" height="12px" />
                  <Skeleton width="60px" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPORTE MENSUAL */}
      <section className="dashboard-section">
        <div className="dashboard-reporte">
          <div className="dashboard-section-header">
            <Skeleton width="180px" height="26px" />
          </div>
          <div className="dashboard-reporte-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="dashboard-reporte-card">
                <Skeleton width="70%" height="13px" />
                <Skeleton width="50%" height="20px" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};