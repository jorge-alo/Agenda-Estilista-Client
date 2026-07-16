import '../styles/Horarios.css'

interface Props {
  disponibles: string[];
  onSelect: (hora: string) => void;
}

export const Horarios = ({ disponibles, onSelect }: Props) => {
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
