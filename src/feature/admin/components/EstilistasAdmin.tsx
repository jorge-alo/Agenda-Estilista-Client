import { useState } from "react";
import { getAuthHeaders } from "../../auth/auth.helpers";
import './EstilistasAdmin.css'

const API_URL = import.meta.env.VITE_API_URL;

interface props {
  estilistas: any[]
  cargarEstilistas: () => void
}

export const EstilistasAdmin = ({ estilistas, cargarEstilistas }: props) => {
  const [nombre, setNombre] = useState("");


  const crear = async () => {
    if (!nombre) {
      alert("Ingresá un nombre");
      return;
    }

    const res = await fetch(`${API_URL}/api/estilistas/admin`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ nombre }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
    } else {
      alert("Estilista creado");
      setNombre("");
      cargarEstilistas(); // 🔥 refresca lista
    }
  };

  const iniciales = (nombre: string) => {
    return nombre.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div>
      <div className="est-admin-form">
        <input
          className="est-admin-input"
          placeholder="Nombre del estilista"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <button className="est-admin-btn" onClick={crear}>
          Crear
        </button>
      </div>

      <ul className="est-admin-lista">
        {estilistas.map((e: any) => (
          <li key={e.id} className="est-admin-item">
            <div className="est-admin-item-avatar">{iniciales(e.nombre)}</div>
            {e.nombre}
          </li>
        ))}
      </ul>
    </div>
  );
};