
interface props {
  estilistas: any[]
  estilistaId: number | null
  setEstilistaId: (val: any) => void
}
export const SelectEstilistas = ({ estilistas, estilistaId, setEstilistaId }: props) => {

 return (
  <div className="est-cards">
    {Array.isArray(estilistas) && estilistas.map((e) => (
      <div
        key={e.id}
        className={`est-card ${estilistaId === e.id ? "selected" : ""}`}
        onClick={() => setEstilistaId(e.id)}
      >
        <div className="est-avatar">
          {e.nombre.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
        </div>
        <div className="est-nombre">{e.nombre}</div>
      </div>
    ))}
  </div>
)
}