export const SelectHorarios = ({ disponibles, onSelect }: any) => {
  if (disponibles.length === 0) {
    return <p>No hay horarios disponibles</p>;
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
  )
};