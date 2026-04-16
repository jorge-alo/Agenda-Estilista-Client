import './Horarios.css'

export const Horarios = ({ disponibles, onSelect }: any) => {
  if (disponibles.length === 0) {
    return <p className="hor-empty">No hay horarios disponibles</p>;
  }

  return (
    <div className="hor-grid">
      {disponibles.map((hora: string) => (
        <button
          key={hora}
          className="hor-btn"
          onClick={() => onSelect(hora)}
        >
          {hora.slice(0, 5)}
        </button>
      ))}
    </div>
  );
};
