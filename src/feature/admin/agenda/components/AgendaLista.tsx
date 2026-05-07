import { useMemo, useState } from "react";
import { formatearFecha } from "../../helpers/formatearFecha.ts";
import { ModalReprogramar } from "../../components/reprogramar/ModalReprogramar.tsx";
import '../styles/AgendaLista.css'
import type { Turno } from "../types/agenda.types.ts";
import { agruparTurnos } from "../helpers/agruparTurnos.ts";
import { useTurnos } from "../hooks/useTurnos.ts";
import { AgendaSemanal } from "./AgendaSemanal.tsx";
import { useCancelarTurno } from "../mutations/useCancelarTurno";
import { useCompletarTurno } from "../mutations/useCompletarTurno";
import { useServicios } from "../hooks/useServicio.ts";
import { getDiasDeSemana } from "../helpers/getSemanaDias.ts";

interface Props {
  estilistas: any[];
}

type Vista = "lista" | "semana";

export const AgendaLista = ({ estilistas }: Props) => {
  const [vista, setVista] = useState<Vista>("lista");
  const [fecha, setFecha] = useState("");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null);
  const [semanaOffset, setSemanaOffset] = useState(0);

  const {
    data: turnos = [],
    isLoading: loading,
  } = useTurnos(
    fecha,
    undefined,
    undefined,
    vista === "lista"
  );

  const dias = useMemo(() => {

    if (vista !== "semana") {
      return [];
    }
    return getDiasDeSemana(
      semanaOffset
    );

  }, [vista, semanaOffset]);

  const {
    data: turnosSemana = [],
    isLoading: loadingSemana,
  } = useTurnos(
    undefined,
    dias[0],
    dias[6],
    vista === "semana"
  );

  const {
    data: servicios = [],
  } = useServicios();


  const cancelarMutation =
    useCancelarTurno();

  const completarMutation =
    useCompletarTurno();


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
            setTurnoSeleccionado(null);
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
                        <button className="agenda-btn cancelar" onClick={() => cancelarMutation.mutate(t.id)}>Cancelar</button>
                        <button className="agenda-btn completar" onClick={() => completarMutation.mutate(t.id)}>Completar</button>
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
            onCancelar={(id) => cancelarMutation.mutate(id)}
            onCompletar={(id) => completarMutation.mutate(id)}
            onReprogramar={setTurnoSeleccionado}
          />
        )
      )}
    </div>
  );
};
