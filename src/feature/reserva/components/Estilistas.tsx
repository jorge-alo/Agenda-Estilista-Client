import "../styles/Estilistas.css";

import { useEstilistasQuery }
from "../queries/useEstilistasQuery";

import type {
  Estilista
} from "../types/reserva.types";

interface Props {
  slug: string;

  estilistaId: number | null;

  setEstilistaId:
    (id: number | null) => void;
}

export const Estilistas = ({
  slug,
  estilistaId,
  setEstilistaId,
}: Props) => {

  const {
    data: estilistas = [],
    isLoading,
    isError,
  } = useEstilistasQuery(slug);

  // función para sacar iniciales

  const iniciales = (
    nombre: string
  ) => {

    return nombre
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <p>
        Cargando estilistas...
      </p>
    );
  }

  if (isError) {
    return (
      <p>
        Error cargando estilistas
      </p>
    );
  }

  return (

    <div className="est-cards">

      {estilistas.map(
        (e: Estilista) => (

          <div
            key={e.id}
            className={`est-card ${
              estilistaId === e.id
                ? "selected"
                : ""
            }`}
            onClick={() =>
              setEstilistaId(e.id)
            }
          >

            <div className="est-avatar">
              {iniciales(e.nombre)}
            </div>

            <div className="est-nombre">
              {e.nombre}
            </div>

          </div>
        )
      )}
    </div>
  );
};
