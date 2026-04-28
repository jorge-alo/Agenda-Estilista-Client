import { useEffect, useState } from "react";
import { getAuthHeaders } from "../../../auth/auth.helpers.ts";
import { formatearFecha } from "../../helpers/formatearFecha.ts";
import { ModalReprogramar } from "../../components/reprogramar/ModalReprogramar.tsx";
import '../styles/AgendaLista.css'
import type { Turno } from "../types/agenda.types.ts";
import { agruparTurnos } from "../helpers/agruparTurnos.ts";
import { obtenerServicios, obtenerTurnos } from "../../../api/Admin.api.ts";
import { useTurnos } from "../hooks/useTurnos.ts";
import { AgendaSemanal } from "./AgendaSemanal.tsx";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  estilistas: any[];
}

type Vista = "lista" | "semana";

function getDiasDeSemana(offset: number): string[] {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diffLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export const AgendaLista = ({ estilistas }: Props) => {
  const [vista, setVista] = useState<Vista>("lista");
  const [fecha, setFecha] = useState("");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null);
  const [servicios, setServicios] = useState<any[]>([]);
  const [turnosSemana, setTurnosSemana] = useState<Turno[]>([]);
  const [loadingSemana, setLoadingSemana] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);

  const { turnos, loading, recargar } = useTurnos(fecha);

  useEffect(() => {
    obtenerServicios()
      .then(setServicios)
      .catch(() => setServicios([]));
  }, []);

  useEffect(() => {
    recargar();
  }, [fecha]);

  useEffect(() => {
    if (vista !== "semana") return;
    cargarSemana(semanaOffset);
  }, [vista, semanaOffset]);

  const cargarSemana = async (offset: number) => {
    setLoadingSemana(true);
    try {
       const dias = getDiasDeSemana(offset);
    console.log("Pidiendo rango:", dias[0], "→", dias[6]);
    const data = await obtenerTurnos(undefined, dias[0], dias[6]);
    console.log("Turnos recibidos:", data);
      setTurnosSemana(data);
    } catch {
      setTurnosSemana([]);
    } finally {
      setLoadingSemana(false);
    }
  };

  const cancelarTurno = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/turnos/${id}/cancelar`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      recargar();
      if (vista === "semana") cargarSemana(semanaOffset);
    } catch (error) {
      console.log("Error cancelando turno:", error);
    }
  };

  const completarTurno = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/turnos/${id}/completar`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      recargar();
      if (vista === "semana") cargarSemana(semanaOffset);
    } catch (error) {
      console.log("Error completando turno:", error);
    }
  };

  const turnosAgrupados = agruparTurnos(turnos);

  return (
    <div>
      {turnoSeleccionado && (
        <ModalReprogramar
          turno={turnoSeleccionado}
          estilistas={estilistas}
          servicios={servicios}
          onClose={() => setTurnoSeleccionado(null)}
          onSuccess={() => {
            recargar();
            if (vista === "semana") cargarSemana(semanaOffset);
          }}
        />
      )}

      <div className="agenda-vista-toggle">
        <button
          className={`agenda-vista-btn ${vista === "lista" ? "activo" : ""}`}
          onClick={() => setVista("lista")}
        >
          ☰ Lista
        </button>
        <button
          className={`agenda-vista-btn ${vista === "semana" ? "activo" : ""}`}
          onClick={() => setVista("semana")}
        >
          📅 Semana
        </button>
      </div>

      {vista === "lista" && (
        loading ? (
          <p className="agenda-empty">Cargando...</p>
        ) : (
          <div>
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
                  {turnos.map((t) => (
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
                        <button className="agenda-btn cancelar" onClick={() => cancelarTurno(t.id)}>Cancelar</button>
                        <button className="agenda-btn completar" onClick={() => completarTurno(t.id)}>Completar</button>
                        <button className="agenda-btn" onClick={() => setTurnoSeleccionado(t)}>Reprogramar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )
      )}

      {vista === "semana" && (
        loadingSemana ? (
          <p className="agenda-empty">Cargando semana...</p>
        ) : (
          <AgendaSemanal
            turnos={turnosSemana}
            semanaOffset={semanaOffset}
            onSemanaChange={setSemanaOffset}
            onCancelar={cancelarTurno}
            onCompletar={completarTurno}
            onReprogramar={setTurnoSeleccionado}
          />
        )
      )}
    </div>
  );
};
