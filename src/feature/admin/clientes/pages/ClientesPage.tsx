import { useClientes }
  from "../hooks/useClientes";

import { ClientesTable }
  from "../components/ClientesTable";

import "../styles/clientes.css";

export const ClientesPage = () => {

  const {
    clientes,
    loading
  } = useClientes();

  if (loading) {
    return <p>Cargando clientes...</p>;
  }

  return (

    <div className="clientes-page">

      <div className="clientes-header">

        <h1>Clientes</h1>

        <p>
          Historial y frecuencia
          de clientes
        </p>

      </div>

      <ClientesTable
        clientes={clientes}
      />

    </div>
  );
};