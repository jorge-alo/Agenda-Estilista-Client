import { useServiciosEstilista } from "../hooks/useServiciosEstilista";

interface Props {
  estilistaId: number | null;
  servicioId: number | null;
  setServicioId: (id: number | null) => void;
}

export const SelectServicios = ({
  estilistaId,
  servicioId,
  setServicioId,
}: Props) => {

  const {
    data: servicios = [],
    isLoading,
  } = useServiciosEstilista(
    estilistaId
  );

  if (!estilistaId) {
    return null;
  }

  if (isLoading) {
    return <p>Cargando servicios...</p>;
  }

  return (
    <div className="srv-cards">
      {servicios.map((s: any) => (
        <div
          key={s.id}
          className={`srv-card ${servicioId === s.id ? "selected" : ""}`}
          onClick={() => setServicioId(s.id)}
        >
          <div className="srv-nombre">{s.nombre}</div>
          <div className="srv-info">{s.duracion}min · ${s.precio}</div>
        </div>
      ))}
    </div>
  )
};
