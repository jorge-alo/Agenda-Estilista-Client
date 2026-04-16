
const API_URL = import.meta.env.VITE_API_URL;

export const getDisponibilidad = async (
  slug: string,
  fecha: string,
  estilistaId: number | null,
  servicioId: number | null
) => {

  const res = await fetch(
    `${API_URL}/api/turnos/disponibilidad?slug=${slug}&fecha=${fecha}&estilista_id=${estilistaId}&servicio_id=${servicioId}`
  );

  const data = await res.json();
  return data;
};

export const reservarTurno = async (reservaData: any) => {
    return await fetch(`${API_URL}/api/public/reservar`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reservaData),
    }).then(res => res.json());
};