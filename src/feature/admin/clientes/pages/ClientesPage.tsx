import { useClientes } from "../hooks/useClientes";
import { ClientesTable } from "../components/ClientesTable";
import { ClientesSkeleton } from "../components/ClientesSkeleton";
import "../styles/clientes.css";

export const ClientesPage = () => {
  const { data: clientes = [], isLoading, isError } = useClientes();

  return (
    <div className="clientes-page">
      <div className="clientes-header">
        <h1>Clientes</h1>
        <p>Historial y frecuencia de clientes</p>
      </div>

      {isError ? (
        <p>Error al cargar clientes</p>
      ) : isLoading ? (
        <ClientesSkeleton />
      ) : (
        <ClientesTable clientes={clientes} />
      )}
    </div>
  );
};