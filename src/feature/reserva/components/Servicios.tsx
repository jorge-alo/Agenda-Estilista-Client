import "../styles/Servicios.css";

import { useServiciosQuery }
from "../queries/useServiciosQuery";
import type { Servicio } from "../types/reserva.types";



interface Props {
  estilistaId: number | null;

  servicioId: number | null;

  setServicioId:
    (id: number | null) => void;

  setServicio:
    (value: string) => void;
}

export const Servicios = ({
  estilistaId,
  servicioId,
  setServicioId,
  setServicio,
}: Props) => {

  const {
    data: servicios = [],
    isLoading,
    isError,
  } = useServiciosQuery(
    estilistaId
  );

  const seleccionarServicio = (
    servicio: Servicio
  ) => {

    setServicioId(servicio.id);

    setServicio(servicio.nombre);
  };

  if (!estilistaId) {
    return null;
  }

  if (isLoading) {
    return (
      <p>
        Cargando servicios...
      </p>
    );
  }

  if (isError) {
    return (
      <p>
        Error cargando servicios
      </p>
    );
  }

  return (
    <div className="srv-cards">

      {servicios.map(
        (s: Servicio) => (

          <div
            key={s.id}
            className={`srv-card ${
              servicioId === s.id
                ? "selected"
                : ""
            }`}
            onClick={() =>
              seleccionarServicio(s)
            }
          >

            <div className="srv-nombre">
              {s.nombre}
            </div>

            <div className="srv-info">
              {s.duracion}min · ${s.precio}
            </div>

          </div>
        )
      )}
    </div>
  );
};