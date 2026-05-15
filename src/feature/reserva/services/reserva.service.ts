const API_URL = import.meta.env.VITE_API_URL;

export const reservaService = {

  getEstilistas: async (slug: string) => {
    const res = await fetch(
      `${API_URL}/api/estilistas?slug=${slug}`
    );

    if (!res.ok) {
      throw new Error("Error cargando estilistas");
    }

    return res.json();
  },

  getServicios: async (estilistaId: number) => {
    const res = await fetch(
      `${API_URL}/api/servicios/estilista/${estilistaId}`
    );

    if (!res.ok) {
      throw new Error("Error cargando servicios");
    }

    return res.json();
  },

  getDisponibilidad: async (
    slug: string,
    fecha: string,
    estilistaId: number,
    servicioId: number
  ) => {

    const params = new URLSearchParams({
      slug,
      fecha,
      estilista_id: String(estilistaId),
      servicio_id: String(servicioId),
    });

    const res = await fetch(
      `${API_URL}/api/turnos/disponibilidad?${params}`
    );

    if (!res.ok) {
      throw new Error("Error cargando disponibilidad");
    }

    return res.json();
  },

  getInfoLocal: async (slug: string) => {

    const res = await fetch(
      `${API_URL}/api/turnos/disponibilidad?slug=${slug}`
    );

    if (!res.ok) {
      throw new Error("Error cargando local");
    }

    return res.json();
  },

  reservar: async (data: any) => {

    const res = await fetch(
      `${API_URL}/api/public/reservar`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      throw new Error("Error reservando turno");
    }

    return res.json();
  },
};