import { useEffect, useState } from "react";
import './Estilistas.css'

const API_URL = import.meta.env.VITE_API_URL;
interface props {
  slug: string
  estilistaId: number | null
  setEstilistaId: (id: number | null) => void
}
export const Estilistas = ({ slug, estilistaId, setEstilistaId }: props) => {
  const [estilistas, setEstilistas] = useState<any[]>([]);


  useEffect(() => {
    fetch(`${API_URL}/api/estilistas?slug=${slug}`)
      .then(res => res.json())
      .then(data => {
        setEstilistas(data);
      });
  }, []);

  // función para sacar las iniciales del nombre
const iniciales = (nombre: string) => {
  return nombre.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

  return (
  <div className="est-cards">
    {estilistas.map((e) => (
      <div
        key={e.id}
        className={`est-card ${estilistaId === e.id ? "selected" : ""}`}
        onClick={() => setEstilistaId(e.id)}
      >
        <div className="est-avatar">{iniciales(e.nombre)}</div>
        <div className="est-nombre">{e.nombre}</div>
      </div>
    ))}
  </div>
);
}
