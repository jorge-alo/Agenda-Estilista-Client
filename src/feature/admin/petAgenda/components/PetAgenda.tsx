import { useMemo, useState } from "react";
import { usePetTurnoActions } from "../hooks/usePetTurnoActions";
import { usePetTurnos } from "../hooks/usePetTurnos";
import { ReprogramarPetTurnoModal } from "./ReprogramarPetTurnoModal";
import type { TurnoPet } from "../types/petTurno.types";
import "../styles/petAgenda.css";

type ModoAgenda = "dia" | "semana";

function fechaLocalKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fechaDesdeKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function rangoSemana(fecha: string): { desde: string; hasta: string; dias: string[] } {
  const selected = fechaDesdeKey(fecha);
  const day = selected.getDay();
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + (day === 0 ? -6 : 1 - day));
  const dias = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return fechaLocalKey(date);
  });
  return { desde: dias[0], hasta: dias[6], dias };
}

function tituloFecha(value: string): string {
  return fechaDesdeKey(value).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function tituloRango(desde: string, hasta: string): string {
  const start = fechaDesdeKey(desde);
  const end = fechaDesdeKey(hasta);
  return `${start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;
}

function labelEstado(estado: TurnoPet["estado"]): string {
  switch (estado) {
    case "activo": return "Activo";
    case "cancelado": return "Cancelado";
    case "completado": return "Completado";
    case "pendiente_pago": return "Pendiente de pago";
    default: return "Estado desconocido";
  }
}

function claseEstado(estado: TurnoPet["estado"]): string {
  switch (estado) {
    case "activo": return "pet-turno__status--active";
    case "cancelado": return "pet-turno__status--cancelled";
    case "completado": return "pet-turno__status--completed";
    case "pendiente_pago": return "pet-turno__status--pending";
    default: return "pet-turno__status--unknown";
  }
}

function PetTurnCard({
  turno,
  onCancelar,
  onCompletar,
  onReprogramar,
  pending,
  mobileCompact = false,
}: {
  turno: TurnoPet;
  onCancelar: (id: number) => void;
  onCompletar: (id: number) => void;
  onReprogramar: (turno: TurnoPet) => void;
  pending: boolean;
  mobileCompact?: boolean;
}) {
  const active = turno.estado === "activo";
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`pet-turno ${active ? "pet-turno--active" : ""}${mobileCompact ? " pet-turno--mobile-collapsible" : ""}${expanded ? " pet-turno--expanded" : ""}`}>
      <button
        type="button"
        className="pet-turno__mobile-summary"
        aria-expanded={expanded}
        aria-controls={`pet-turno-details-${turno.id}`}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="pet-turno__mobile-time">{turno.hora}–{turno.horaFin ?? "--:--"}</span>
        <span className={`pet-turno__status ${claseEstado(turno.estado)}`}>
          {labelEstado(turno.estado)}
        </span>
        <strong className="pet-turno__mobile-pet">{turno.mascota.nombre}</strong>
        <span className="pet-turno__mobile-service">{turno.servicio.nombre}</span>
      </button>

      <div id={`pet-turno-details-${turno.id}`} className="pet-turno__details">
        <header className="pet-turno__header">
          <time className="pet-turno__time">
            {turno.hora}–{turno.horaFin ?? "--:--"}
          </time>
          <span className={`pet-turno__status ${claseEstado(turno.estado)}`}>
            {labelEstado(turno.estado)}
          </span>
        </header>

        <div className={`pet-turno__pet${turno.mascota.altaExigenciaSnapshot === true ? " pet-turno__pet--high-demand" : ""}`}>
          <h3>{turno.mascota.nombre}</h3>
          {turno.mascota.altaExigenciaSnapshot === true && (
            <span className="pet-turno__high-demand">Alta exigencia</span>
          )}
        </div>

        <p className="pet-turno__service">
          {turno.servicio.nombre} <span>({turno.servicio.duracionMinutos} min)</span>
        </p>
        <p className="pet-turno__mobile-duration">Duración del servicio: {turno.servicio.duracionMinutos} min</p>

        {turno.extras.length > 0 && (
          <ul className="pet-turno__extras" aria-label="Extras del turno">
            {turno.extras.map((extra, index) => (
              <li key={`${extra.id ?? "snapshot"}-${index}`}>
                {extra.nombre} (+{extra.duracionMinutos} min)
              </li>
            ))}
          </ul>
        )}

        <div className="pet-turno__responsible">
          <span>{turno.responsable.nombre}</span>
          <a href={`tel:${turno.responsable.telefono}`}>{turno.responsable.telefono}</a>
        </div>

        {active && (
          <footer className="pet-turno__actions">
            <button type="button" disabled={pending} onClick={() => onReprogramar(turno)}>
              Reprogramar
            </button>
            <button type="button" disabled={pending} onClick={() => onCancelar(turno.id)}>
              Cancelar
            </button>
            <button type="button" disabled={pending} onClick={() => onCompletar(turno.id)}>
              Completar
            </button>
          </footer>
        )}
      </div>
    </article>
  );
}

export function PetAgenda() {
  const [mode, setMode] = useState<ModoAgenda>("dia");
  const [focusDate, setFocusDate] = useState(() => fechaLocalKey(new Date()));
  const [turnoParaReprogramar, setTurnoParaReprogramar] = useState<TurnoPet | null>(null);
  const week = useMemo(() => rangoSemana(focusDate), [focusDate]);
  const query = mode === "dia"
    ? { fecha: focusDate }
    : { desde: week.desde, hasta: week.hasta };
  const { data: turnos = [], isLoading, isError, refetch } = usePetTurnos(query);
  const { cancelar, completar } = usePetTurnoActions();

  const goTo = (amount: number) => {
    const next = fechaDesdeKey(focusDate);
    next.setDate(next.getDate() + amount * (mode === "semana" ? 7 : 1));
    setFocusDate(fechaLocalKey(next));
  };
  const turnoProps = {
    onCancelar: (id: number) => cancelar.mutate(id),
    onCompletar: (id: number) => completar.mutate(id),
    onReprogramar: (turno: TurnoPet) => setTurnoParaReprogramar(turno),
    pending: cancelar.isPending || completar.isPending,
  };

  const turnosPorFecha = useMemo(() => {
    const grouped = new Map<string, TurnoPet[]>();
    for (const turno of turnos) {
      const current = grouped.get(turno.fecha) ?? [];
      current.push(turno);
      grouped.set(turno.fecha, current);
    }
    return grouped;
  }, [turnos]);

  const turnosPorHora = useMemo(() => {
    const grouped = new Map<string, TurnoPet[]>();
    for (const turno of turnosPorFecha.get(focusDate) ?? []) {
      const current = grouped.get(turno.hora) ?? [];
      current.push(turno);
      grouped.set(turno.hora, current);
    }
    return grouped;
  }, [turnosPorFecha, focusDate]);

  if (isLoading) return <p className="pet-agenda__message" role="status">Cargando agenda PET…</p>;
  if (isError) {
    return (
      <div className="pet-agenda__message" role="alert">
        <p>No se pudo cargar la agenda PET.</p>
        <button type="button" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }

  return (
    <section className="pet-agenda" aria-label="Agenda PET">
      <header className="pet-agenda__toolbar">
        <div className="pet-agenda__modes" role="group" aria-label="Modo de agenda">
          <button type="button" aria-pressed={mode === "dia"} onClick={() => setMode("dia")}>Día</button>
          <button type="button" aria-pressed={mode === "semana"} onClick={() => setMode("semana")}>Semana</button>
        </div>
        <div className="pet-agenda__navigation">
          <button type="button" aria-label="Período anterior" onClick={() => goTo(-1)}>‹</button>
          <strong>{mode === "dia" ? tituloFecha(focusDate) : tituloRango(week.desde, week.hasta)}</strong>
          <button type="button" aria-label="Período siguiente" onClick={() => goTo(1)}>›</button>
          <button type="button" onClick={() => setFocusDate(fechaLocalKey(new Date()))}>Hoy</button>
        </div>
        <label className="pet-agenda__date-picker">
          <span>Ir a fecha</span>
          <input type="date" value={focusDate} onChange={event => {
            if (event.target.value) setFocusDate(event.target.value);
          }} />
        </label>
      </header>

      {mode === "dia" ? (
        turnosPorHora.size === 0 ? (
          <p className="pet-agenda__message">No hay turnos para este día.</p>
        ) : (
          <div className="pet-agenda__day">
            {[...turnosPorHora].map(([hora, horaTurnos]) => (
              <section className="pet-agenda__time-group" key={hora}>
                <h2 className="pet-agenda__time-heading">
                  <time>{hora}</time>
                  <span>{horaTurnos.length} {horaTurnos.length === 1 ? "turno" : "turnos"}</span>
                </h2>
                <div className="pet-agenda__time-grid">
                  {horaTurnos.map(turno => <PetTurnCard key={turno.id} turno={turno} mobileCompact {...turnoProps} />)}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="pet-agenda__week">
          {week.dias.map(date => {
            const dateTurnos = turnosPorFecha.get(date) ?? [];
            return (
              <section className="pet-agenda__day-column" key={date}>
                <header>
                  <button
                    type="button"
                    className="pet-agenda__day-link"
                    aria-label={`Ver agenda del ${fechaDesdeKey(date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
                    onClick={() => {
                      setFocusDate(date);
                      setMode("dia");
                    }}
                  >
                    {fechaDesdeKey(date).toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })}
                  </button>
                  <span>{dateTurnos.length}</span>
                </header>
                {dateTurnos.length === 0
                  ? <p className="pet-agenda__day-empty">Sin turnos</p>
                  : dateTurnos.map(turno => <PetTurnCard key={turno.id} turno={turno} {...turnoProps} />)}
              </section>
            );
          })}
        </div>
      )}
      {turnoParaReprogramar && (
        <ReprogramarPetTurnoModal
          turno={turnoParaReprogramar}
          onClose={() => setTurnoParaReprogramar(null)}
          onSuccess={() => setTurnoParaReprogramar(null)}
        />
      )}
    </section>
  );
}
