export const BloqueosSkeleton = () => {
  return (
    <div className="bloqueos-list">
      <h2>Bloqueos activos</h2>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bloqueo-card">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div className="skeleton-shimmer-clientes" style={{ width: "140px", height: "18px" }} />
            <div className="skeleton-shimmer-clientes" style={{ width: "100px", height: "13px" }} />
            <div className="skeleton-shimmer-clientes" style={{ width: "160px", height: "13px" }} />
          </div>
          <div className="skeleton-shimmer-clientes" style={{ width: "80px", height: "36px", borderRadius: "8px" }} />
        </div>
      ))}
    </div>
  );
};