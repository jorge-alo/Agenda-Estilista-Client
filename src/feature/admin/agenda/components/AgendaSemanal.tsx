import { useState } from "react";
import type { Turno } from "../types/agenda.types";
import "../styles/agendaSemanal.css";

interface Props {
  turnos: Turno[];
  semanaOffset: number;
  onSemanaChange: (offset: number) => void;
  onCancelar: (id: number) => void;
  onCompletar: (id: number) => void;
  onReprogramar: (turno: Turno) => void;
}

const SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMin = 8 * 60 + i * 30;
  const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const m = (totalMin % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getLunesConOffset(offset: number): Date {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diffLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function getDiasSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getColorEstado(estado?: string) {
  switch (estado) {
    case "completado": return "estado-completado";
    case "cancelado": return "estado-cancelado";
    default: return "estado-pendiente";
  }
}

export const AgendaSemanal = ({
  turnos,
  semanaOffset,
  onSemanaChange,
  onCancelar,
  onCompletar,
  onReprogramar,
}: Props) => {
  const [turnoExpandido, setTurnoExpandido] = useState<number | null>(null);

  const lunes = getLunesConOffset(semanaOffset);
  const dias = getDiasSemana(lunes);
  const hoy = toDateKey(new Date());

  // Indexar turnos por fecha — normalizar a YYYY-MM-DD por si viene como ISO
  const turnosPorFecha: Record<string, Turno[]> = {};
  for (const t of turnos) {
    const fecha = (t.fecha ?? "").slice(0, 10);
    if (!turnosPorFecha[fecha]) turnosPorFecha[fecha] = [];
    turnosPorFecha[fecha].push(t);
  }

  const rangoSemana = `${dias[0].getDate()} ${dias[0].toLocaleString("es", { month: "short" })} — ${dias[6].getDate()} ${dias[6].toLocaleString("es", { month: "short", year: "numeric" })}`;

  return (
    <div className="semanal-wrapper">
      <div className="semanal-nav">
        <button className="semanal-nav-btn" onClick={() => onSemanaChange(semanaOffset - 1)}>‹</button>
        <span className="semanal-rango">{rangoSemana}</span>
        <button className="semanal-nav-btn" onClick={() => onSemanaChange(semanaOffset + 1)}>›</button>
        {semanaOffset !== 0 && (
          <button className="semanal-hoy-btn" onClick={() => onSemanaChange(0)}>Hoy</button>
        )}
      </div>

      <div className="semanal-scroll">
        <div className="semanal-grid">
          {/* Columna de horas */}
          <div className="semanal-col-horas">
            <div className="semanal-header-vacio" />
            {SLOTS.map(h => (
              <div key={h} className={`semanal-hora-label ${h.endsWith(":00") ? "" : "media"}`}>
                {h.endsWith(":00") ? h : "·"}
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {dias.map((dia, i) => {
            const key = toDateKey(dia);
            const esHoy = key === hoy;
            const turnosDia = turnosPorFecha[key] ?? [];

            return (
              <div key={key} className={`semanal-col-dia ${esHoy ? "semanal-col-hoy" : ""}`}>
                <div className={`semanal-dia-header ${esHoy ? "hoy" : ""}`}>
                  <span className="semanal-dia-nombre">{DIAS_SEMANA[i]}</span>
                  <span className={`semanal-dia-num ${esHoy ? "hoy" : ""}`}>{dia.getDate()}</span>
                  {turnosDia.length > 0 && (
                    <span className="semanal-badge">{turnosDia.length}</span>
                  )}
                </div>

                <div className="semanal-dia-body">
                  {SLOTS.map(h => {
                    const turnosEnHora = turnosDia.filter(t =>
                      (t.hora?.slice(0, 5) ?? "") === h
                    );

                    return (
                      <div key={h} className="semanal-franja">
                        {turnosEnHora.map(t => (
                          <div
                            key={t.id}
                            className={`semanal-turno ${getColorEstado(t.estado)} ${turnoExpandido === t.id ? "expandido" : ""}`}
                            onClick={() => setTurnoExpandido(turnoExpandido === t.id ? null : t.id)}
                          >
                            <div className="semanal-turno-top">
                              <span className="semanal-turno-hora">{t.hora?.slice(0, 5)}</span>
                              <span className="semanal-turno-servicio">{t.servicio_nombre}</span>
                            </div>
                            <div className="semanal-turno-cliente">👤 {t.cliente_nombre}</div>

                            {turnoExpandido === t.id && (
                              <div className="semanal-turno-detalle">
                                <div>📞 {t.cliente_telefono}</div>
                                <div>💇 {t.estilista_nombre}</div>
                                <div>⏱ hasta {t.hora_fin?.slice(0, 5)}</div>
                                <div className="semanal-turno-acciones">
                                  <button
                                    className="semanal-btn cancelar"
                                    onClick={e => { e.stopPropagation(); onCancelar(t.id); }}
                                  >Cancelar</button>
                                  <button
                                    className="semanal-btn completar"
                                    onClick={e => { e.stopPropagation(); onCompletar(t.id); }}
                                  >Completar</button>
                                  <button
                                    className="semanal-btn reprogramar"
                                    onClick={e => { e.stopPropagation(); onReprogramar(t); }}
                                  >Reprogramar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

