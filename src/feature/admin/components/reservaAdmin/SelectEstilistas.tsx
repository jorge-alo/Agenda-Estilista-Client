import { useEffect } from "react";
import { getAuthHeaders } from "../../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;
interface props {
  estilistas: any[]
  setEstilistas: (val: any) => void
  estilistaId: number | null
  setEstilistaId: (val: any) => void
}
export const SelectEstilistas = ({ estilistas, setEstilistas, estilistaId, setEstilistaId }: props) => {

  const cargarEstilistas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/estilistas/admin`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        // Si el servidor dice que no estás autorizado (401)
        if (res.status === 401) {
          localStorage.removeItem("token"); // Limpiamos el token basura
          window.location.href = "/login"; // Forzamos salida
        }
        setEstilistas([]); // Seteamos array vacío para que .map no falle
        return;
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setEstilistas(data);
      } else {
        setEstilistas([]);
      }

    } catch (error) {
      console.log("Error cargando turnos:", error);
      setEstilistas([]);
    }

  };

  console.log("Valor de estilistas en cargarEstilistas", estilistas);

  useEffect(() => {
    cargarEstilistas();
  }, []);

 return (
  <div className="est-cards">
    {Array.isArray(estilistas) && estilistas.map((e) => (
      <div
        key={e.id}
        className={`est-card ${estilistaId === e.id ? "selected" : ""}`}
        onClick={() => setEstilistaId(e.id)}
      >
        <div className="est-avatar">
          {e.nombre.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
        </div>
        <div className="est-nombre">{e.nombre}</div>
      </div>
    ))}
  </div>
)
}