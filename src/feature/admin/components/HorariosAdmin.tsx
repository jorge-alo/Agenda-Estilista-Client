import { useEffect, useState } from "react";
import './HorariosAdmin.css'

const API_URL = import.meta.env.VITE_API_URL;

const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
];

interface props {
  estilistas: any[]
  estilistaId: number | null
 setEstilistaId: (val:any) => void
}


export const HorariosAdmin = ({ estilistas, estilistaId,setEstilistaId }: props) => {
    

    const [dia, setDia] = useState(1);
    const [inicio, setInicio] = useState("09:00");
    const [fin, setFin] = useState("18:00");

    const [horarios, setHorarios] = useState<any[]>([]);


    // cargar horarios
    useEffect(() => {
        if (!estilistaId) return;

        fetch(`${API_URL}/api/horarios/${estilistaId}`)
            .then(res => res.json())
            .then(setHorarios);
    }, [estilistaId]);

    const crear = async () => {
        if (!estilistaId) {
            alert("Selecciona estilista");
            return;
        }

        const res = await fetch(`${API_URL}/api/horarios`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                estilista_id: estilistaId,
                dia_semana: dia,
                hora_inicio: inicio + ":00",
                hora_fin: fin + ":00",
            }),
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert("Horario creado");

            const updated = await fetch(
                `${API_URL}/api/horarios/${estilistaId}`
            ).then(res => res.json());

            setHorarios(updated);
        }
    };

    const toggle = async (id: number) => {
        await fetch(`${API_URL}/api/horarios/${id}/toggle`, {
            method: "PATCH",
        });

        // 🔥 recargar lista
        const updated = await fetch(
            `${API_URL}/api/horarios/${estilistaId}`
        ).then(res => res.json());

        setHorarios(updated);
    };

   return (
  <div>
    <select
      className="hor-admin-select"
      value={estilistaId ?? ""}
      onChange={(e) => setEstilistaId(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">Seleccionar estilista</option>
      {estilistas.map((e: any) => (
        <option key={e.id} value={e.id}>{e.nombre}</option>
      ))}
    </select>

    {estilistaId && (
      <>
        <div className="hor-admin-label">Agregar horario</div>

        <div className="hor-admin-form">
          <select
            className="hor-admin-select"
            value={dia}
            onChange={(e) => setDia(Number(e.target.value))}
          >
            {dias.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>

          <input
            className="hor-admin-input"
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />

          <input
            className="hor-admin-input"
            type="time"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />

          <button className="hor-admin-btn" onClick={crear}>
            Agregar horario
          </button>
        </div>

        <div className="hor-admin-label">Horarios cargados</div>

        <ul className="hor-admin-lista">
          {horarios.map((h) => (
            <li
              key={h.id}
              className={`hor-admin-item ${h.activo ? "" : "inactivo"}`}
            >
              <div>
                <div className="hor-admin-item-info">
                  {dias[h.dia_semana]}
                </div>
                <div className="hor-admin-item-sub">
                  {h.hora_inicio.slice(0, 5)} → {h.hora_fin.slice(0, 5)}
                </div>
              </div>

              <button
                className={`hor-admin-toggle ${h.activo ? "activo" : "inactivo"}`}
                onClick={() => toggle(h.id)}
              >
                {h.activo ? "Activo" : "Inactivo"}
              </button>
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);
};