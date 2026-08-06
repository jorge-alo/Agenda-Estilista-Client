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

    console.log("🔍 DEBUG FRONTEND SERVICE - STATUS DE LA RESPUESTA:", res.status);

     if (!res.ok) {
    // ✅ NUEVO: Leemos el JSON del error para obtener el mensaje real del backend
    const errorData = await res.json().catch(() => ({}));
     console.log("🚨 DEBUG FRONTEND SERVICE - DATOS DEL ERROR:", errorData);
    throw new Error(errorData.error || "Error cargando local");
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
      const errorData = await res.json(); // ✅ CAMBIO 1: Leemos el error que envía el backend
      throw new Error(errorData.error || "Error reservando turno"); // ✅ CAMBIO 2: Mostramos ese error
    }

    return res.json();
  },
};