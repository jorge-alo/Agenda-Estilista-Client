import { useEffect, useState } from "react";
import {
    getServiciosPorEstilista,
    asignarServicio,
    desasignarServicio,
} from "../Admin.api";
import { getAuthHeaders } from "../../auth/auth.helpers";
import './ServiciosAdmin.css'

const API_URL = import.meta.env.VITE_API_URL;

interface props {
    estilistas: any[]
    estilistaId: number | null
    setEstilistaId: (val: any) => void
}

export const ServiciosAdmin = ({ estilistas, estilistaId, setEstilistaId }: props) => {

    const [servicios, setServicios] = useState<any[]>([]);
    const [serviciosAsignados, setServiciosAsignados] = useState<any[]>([]);


    const [servicioId, setServicioId] = useState<number | null>(null);

    // 🔥 NUEVO → form servicio
    const [nombre, setNombre] = useState("");
    const [duracion, setDuracion] = useState<number>(30);
    const [precio, setPrecio] = useState<number>(0);

    const cargarServicios = async () => {
        try {
            const res = await fetch(`${API_URL}/api/servicios/admin`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            setServicios(data);

        } catch (error) {
            console.log("Error cargando turnos:", error);
        }

    };
     useEffect(() => {
        cargarServicios();
    }, []);
    console.log("VAlor de servicios", servicios);
    // servicios por estilista
    useEffect(() => {
        if (!estilistaId) return;
        getServiciosPorEstilista(estilistaId).then(setServiciosAsignados);
    }, [estilistaId]);

    // 🔥 CREAR SERVICIO
    const crearServicio = async () => {
        if (!nombre || !duracion) {
            alert("Faltan datos");
            return;
        }

        const res = await fetch(`${API_URL}/api/servicios`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                nombre,
                duracion,
                precio,
            }),
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert("Servicio creado");
            setNombre("");
            setDuracion(30);
            setPrecio(0);
            await cargarServicios();
        }
    };

    // 🔥 ASIGNAR
    const handleAsignar = async () => {
        if (!estilistaId || !servicioId) {
            alert("Selecciona todo");
            return;
        }

        await asignarServicio({
            estilista_id: estilistaId,
            servicio_id: servicioId,
        });

        const data = await getServiciosPorEstilista(estilistaId);
        setServiciosAsignados(data);
        setServicioId(null);
    };

    const eliminarServicio = async (id: number) => {
        const res = await fetch(`${API_URL}/api/servicios/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders()          
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }


        await cargarServicios();
    };

    const toggleServicio = async (id: number) => {
        await fetch(`${API_URL}/api/servicios/${id}/toggle`, {
            method: "PATCH",
        });
         await cargarServicios();
    };

    const handleDesasignar = async (servicio_id: number) => {
        if (!estilistaId) return;

        await desasignarServicio({
            estilista_id: estilistaId,
            servicio_id
        });

        // 🔥 refrescar lista
        const data = await getServiciosPorEstilista(estilistaId);
        setServiciosAsignados(data);
    };

   return (
  <div>
    <div className="srv-admin-label">Crear servicio</div>

    <div className="srv-admin-form">
      <input
        className="srv-admin-input"
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <input
        className="srv-admin-input"
        type="number"
        placeholder="Duración (min)"
        value={duracion}
        onChange={(e) => setDuracion(Number(e.target.value))}
      />
      <input
        className="srv-admin-input"
        type="number"
        placeholder="Precio"
        value={precio}
        onChange={(e) => setPrecio(Number(e.target.value))}
      />
      <button className="srv-admin-btn" onClick={crearServicio}>
        Crear
      </button>
    </div>

    <div className="srv-admin-divider" />

    {servicios.length > 0 && (
      <ul className="srv-admin-lista">
        {servicios.map((s) => (
          <li key={s.id} className="srv-admin-item">
            <div>
              <div className="srv-admin-item-info">{s.nombre}</div>
              <div className="srv-admin-item-sub">{s.duracion}min · ${s.precio}</div>
            </div>
            <div className="srv-admin-item-acciones">
              <button
                className="srv-admin-item-btn"
                onClick={() => toggleServicio(s.id)}
              >
                {s.activo ? "Activo" : "Inactivo"}
              </button>
              <button
                className="srv-admin-item-btn danger"
                onClick={() => eliminarServicio(s.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}

    <div className="srv-admin-label">Asignar a estilista</div>

    <select
      className="srv-admin-select"
      value={estilistaId ?? ""}
      onChange={(e) => setEstilistaId(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Seleccionar estilista</option>
      {estilistas.map((e: any) => (
        <option key={e.id} value={e.id}>{e.nombre}</option>
      ))}
    </select>

    <select
      className="srv-admin-select"
      value={servicioId ?? ""}
      onChange={(e) => setServicioId(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Seleccionar servicio</option>
      {servicios.map((s) => (
        <option key={s.id} value={s.id}>{s.nombre} · ${s.precio}</option>
      ))}
    </select>

    <button className="srv-admin-btn" onClick={handleAsignar}>
      Asignar
    </button>

    {serviciosAsignados.length > 0 && (
      <>
        <div className="srv-admin-divider" />
        <div className="srv-admin-label">Servicios del estilista</div>
        <ul className="srv-admin-lista">
          {serviciosAsignados.map((s) => (
            <li key={s.id} className="srv-admin-item">
              <div>
                <div className="srv-admin-item-info">{s.nombre}</div>
                <div className="srv-admin-item-sub">{s.duracion}min · ${s.precio}</div>
              </div>
              <button
                className="srv-admin-item-btn danger"
                onClick={() => handleDesasignar(s.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);
};