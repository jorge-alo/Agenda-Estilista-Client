import {
  useHistorialClientes
} from "../hooks/useHistorialClientes";

export const HistorialClientes = () => {

  const {
    clientes,
    loading
  } = useHistorialClientes();

  if (loading) {
    return <p>Cargando clientes...</p>;
  }

  return (

    <div className="dashboard-clientes">

      <div className="dashboard-section-header">

        <h2 className="dashboard-section-title">
          Clientes frecuentes
        </h2>

      </div>

      <div className="dashboard-clientes-list">

        {clientes.map(cliente => (

          <div
            key={`${cliente.cliente_telefono}-${cliente.cliente_nombre}`}
            className="dashboard-cliente-card"
          >

            <div>

              <div className="dashboard-cliente-nombre">
                {cliente.cliente_nombre}
              </div>

              <div className="dashboard-cliente-phone">
                {cliente.cliente_telefono}
              </div>

            </div>

            <div className="dashboard-cliente-info">

              <span>
                {cliente.visitas} visitas
              </span>

              <span>
               <span style={{color: "#56349a"}}>Ultimo servicio</span> ({cliente.ultimo_servicio})
              </span>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
};