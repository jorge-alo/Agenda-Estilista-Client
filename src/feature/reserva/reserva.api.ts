const API_URL = import.meta.env.VITE_API_URL;

export const getDisponibilidad = async (
  slug: string,
  fecha: string,
  estilistaId: number | null,
  servicioId: number | null
) => {
  const params = new URLSearchParams({ slug, fecha });
  if (estilistaId !== null) params.append("estilista_id", String(estilistaId));
  if (servicioId !== null) params.append("servicio_id", String(servicioId));

  const res = await fetch(`${API_URL}/api/turnos/disponibilidad?${params}`);
  return res.json();
};

export const reservarTurno = async (reservaData: any) => {
  return await fetch(`${API_URL}/api/public/reservar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservaData),
  }).then(res => res.json());
};