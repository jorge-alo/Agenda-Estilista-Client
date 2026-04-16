import { useEffect, useState } from "react";
import './Servicios.css'
const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  estilistaId: number | null;
  servicioId: number | null;
  setServicioId: (id: number | null) => void;
  setServicio: (value: string) => void;
}

export const Servicios = ({
  estilistaId,
  servicioId,
  setServicioId,
  setServicio
}: Props) => {
  const [servicios, setServicios] = useState<any[]>([]);

  useEffect(() => {
    if (!estilistaId) {
      setServicios([]);
      return;
    }

    fetch(`${API_URL}/api/servicios/estilista/${estilistaId}`)
      .then((res) => res.json())
      .then((data) => {
        setServicios(data);
      });
  }, [estilistaId]);

  const getServicio = (id: number) => {
    setServicioId(id)
    const servicio = servicios.find(s => s.id === id);
    setServicio(servicio.nombre);
  }

 return (
  <div className="srv-cards">
    {servicios.map((s) => (
      <div
        key={s.id}
        className={`srv-card ${servicioId === s.id ? "selected" : ""}`}
        onClick={() => getServicio(s.id)}
      >
        <div className="srv-nombre">{s.nombre}</div>
        <div className="srv-info">{s.duracion}min · ${s.precio}</div>
      </div>
    ))}
  </div>
);
};