import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

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
  const [servicios, setServicios] = useState<any[]>([]);

  useEffect(() => {
    if (!estilistaId) {
      setServicios([]);
      return;
    }

    fetch(`${API_URL}/api/servicios/estilista/${estilistaId}`, {headers: getAuthHeaders()})
      .then((res) => res.json())
      .then((data) => {
        setServicios(data);
      });
  }, [estilistaId]);

  return (
  <div className="srv-cards">
    {servicios.map((s) => (
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
