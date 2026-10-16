import { useMemo, useState } from "react";
import { usePetTurnoActions } from "../hooks/usePetTurnoActions";
import { usePetTurnos } from "../hooks/usePetTurnos";
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
  pending,
}: {
  turno: TurnoPet;
  onCancelar: (id: number) => void;
  onCompletar: (id: number) => void;
  pending: boolean;
}) {
  const active = turno.estado === "activo";

  return (
    <article className={`pet-turno ${active ? "pet-turno--active" : ""}`}>
      <header className="pet-turno__header">
        <time className="pet-turno__time">
          {turno.hora}–{turno.horaFin ?? "--:--"}
        </time>
        <span className={`pet-turno__status ${claseEstado(turno.estado)}`}>
          {labelEstado(turno.estado)}
        </span>
      </header>

      <div className="pet-turno__pet">
        <h3>{turno.mascota.nombre}</h3>
        {turno.mascota.altaExigenciaSnapshot === true && (
          <span className="pet-turno__high-demand">Alta exigencia</span>
        )}
      </div>

      <p className="pet-turno__service">
        {turno.servicio.nombre} <span>({turno.servicio.duracionMinutos} min)</span>
      </p>

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
          <button type="button" disabled title="La reprogramación desde Agenda PET estará disponible próximamente">
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
    </article>
  );
}

export function PetAgenda() {
  const [mode, setMode] = useState<ModoAgenda>("semana");
  const [focusDate, setFocusDate] = useState(() => fechaLocalKey(new Date()));
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
        (turnosPorFecha.get(focusDate) ?? []).length === 0 ? (
          <p className="pet-agenda__message">No hay turnos para este día.</p>
        ) : (
          <div className="pet-agenda__day">
            {(turnosPorFecha.get(focusDate) ?? []).map(turno => <PetTurnCard key={turno.id} turno={turno} {...turnoProps} />)}
          </div>
        )
      ) : (
        <div className="pet-agenda__week">
          {week.dias.map(date => {
            const dateTurnos = turnosPorFecha.get(date) ?? [];
            return (
              <section className="pet-agenda__day-column" key={date}>
                <header>
                  <h2>{fechaDesdeKey(date).toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })}</h2>
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
    </section>
  );
}
