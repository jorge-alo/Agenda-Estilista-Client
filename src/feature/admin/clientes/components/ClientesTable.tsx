import type { Cliente }
  from "../types/clientes.types";

interface Props {
  clientes: Cliente[];
}

export const ClientesTable = ({
  clientes
}: Props) => {

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

        {clientes.map((cliente) => (

          <tr key={cliente.id}>

            <td>{cliente.nombre}</td>

            <td>{cliente.telefono}</td>

            <td>{cliente.total_turnos}</td>

            <td>{cliente.ultimo_servicio}</td>

            <td>{cliente.ultima_visita}</td>

          </tr>

        ))}

      </tbody>

    </table>
  );
};