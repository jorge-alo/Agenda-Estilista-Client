interface Props {
  rows?: number;
}

export const ClientesSkeleton = ({ rows = 5 }: Props) => {
  return (
    <table className="clientes-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>Turnos</th>
          <th>Último servicio</th>
          <th>Última visita</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            <td><div className="skeleton-shimmer-clientes" style={{ width: "70%", height: "14px" }} /></td>
            <td><div className="skeleton-shimmer-clientes" style={{ width: "60%", height: "14px" }} /></td>
            <td><div className="skeleton-shimmer-clientes" style={{ width: "30%", height: "14px" }} /></td>
            <td><div className="skeleton-shimmer-clientes" style={{ width: "50%", height: "14px" }} /></td>
            <td><div className="skeleton-shimmer-clientes" style={{ width: "50%", height: "14px" }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};