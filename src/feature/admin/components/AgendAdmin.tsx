import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../auth/auth.helpers.ts";
import { formatearFecha } from "../helpers/formatearFecha.ts";
import { ModalReprogramar } from "./reprogramar/ModalReprogramar.tsx";
import './AgendAdmin.css'

const API_URL = import.meta.env.VITE_API_URL;
interface props {
  estilistas: any[]
}
export const AgendaAdmin = ({ estilistas }: props) => {
  const [fecha, setFecha] = useState("");
  const [turnos, setTurnos] = useState<any[]>([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<any | null>(null);
  const [servicios, setServicios] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/servicios/admin`, {
      headers: getAuthHeaders()
    })
      .then(res => res.json())
      .then(data => setServicios(data));
  }, []);

  const cargarTurnos = async () => {
    try {
      // si hay fecha seleccionada filtra, sino trae todos los futuros
      const url = fecha
        ? `${API_URL}/api/turnos?fecha=${fecha}`
        : `${API_URL}/api/turnos/futuros`;

      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        // Si es 401, podrías redirigir al login o limpiar el estado
        console.error(`Error de autenticación o servidor: ${res.status}`);
        setTurnos([]); // Seteamos array vacío para que .reduce() no falle
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setTurnos(data);
      } else {
        console.error("La API no devolvió un array:", data);
        setTurnos([]);
      }
    } catch (error) {
      console.log("Error cargando turnos:", error);
      setTurnos([]);
    }
  };

  const cancelarTurno = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/turnos/${id}/cancelar`, {
        method: "PATCH",
        headers: getAuthHeaders()
      });
      cargarTurnos();
    } catch (error) {
      console.log("Error cancelando turno:", error);
    }
  };

  const completarTurno = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/turnos/${id}/completar`, {
        method: "PATCH",
        headers: getAuthHeaders()
      });
      cargarTurnos();
    } catch (error) {
      console.log("Error completando turno:", error);
    }
  };


  useEffect(() => {
    cargarTurnos();
  }, [fecha]);

  const turnosAgrupados = turnos.reduce((grupo, turno) => {
    const fecha = turno.fecha; // la fecha del turno

    if (!grupo[fecha]) {
      grupo[fecha] = []; // si no existe esa fecha, la crea
    }

    grupo[fecha].push(turno); // agrega el turno a esa fecha

    return grupo;
  }, {});

  return (
    <div>
      {turnoSeleccionado && (
        <ModalReprogramar
          turno={turnoSeleccionado}
          estilistas={estilistas}
          servicios={servicios}
          onClose={() => setTurnoSeleccionado(null)}
          onSuccess={cargarTurnos}
        />
      )}

      <div className="agenda-filtro">
        <input
          className="agenda-date-input"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {turnos.length === 0 ? (
        <p className="agenda-empty">No hay turnos</p>
      ) : (
        Object.entries(turnosAgrupados).map(([fecha, turnos]) => (
          <div key={fecha}>
            <h3 className="agenda-fecha-titulo">{formatearFecha(fecha)}</h3>
            {(turnos as any[]).map((t) => (
              <div key={t.id} className="agenda-turno">
                <div className="agenda-turno-hora">
                  {t.hora?.slice(0, 5)}
                  <span>→ {t.hora_fin?.slice(0, 5)}</span>
                </div>
                <div className="agenda-turno-info">✂️ {t.servicio_nombre}</div>
                <div className="agenda-turno-info">👤 {t.cliente_nombre}</div>
                <div className="agenda-turno-info">📞 {t.cliente_telefono}</div>
                <div className="agenda-turno-info">💇 {t.estilista_nombre}</div>

                <div className="agenda-turno-acciones">
                  <button
                    className="agenda-btn cancelar"
                    onClick={() => cancelarTurno(t.id)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="agenda-btn completar"
                    onClick={() => completarTurno(t.id)}
                  >
                    Completar
                  </button>
                  <button
                    className="agenda-btn"
                    onClick={() => setTurnoSeleccionado(t)}
                  >
                    Reprogramar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
);
};