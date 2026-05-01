import { getAuthHeaders }
  from "../../../auth/auth.helpers";

import type {
    Bloqueo,
  CrearBloqueoDTO
} from "../types/bloqueos.types";

const API_URL =
  import.meta.env.VITE_API_URL;

export const bloqueosService = {

  crear: async (
    data: CrearBloqueoDTO
  ) => {

    const res = await fetch(
      `${API_URL}/api/bloqueos`,
      {
        method: "POST",

        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },

        body: JSON.stringify(data)
      }
    );

    const result = await res.json();

    if (!res.ok) {
      throw new Error(
        result.error || "Error"
      );
    }

    return result;
  },
    getBloqueos:
    async (): Promise<Bloqueo[]> => {

      const res = await fetch(
        `${API_URL}/api/bloqueos`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {
        throw new Error(
          "Error cargando bloqueos"
        );
      }

      return res.json();
    },

  eliminarBloqueo:
    async (id: number) => {

      const res = await fetch(
        `${API_URL}/api/bloqueos/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {
        throw new Error(
          "Error eliminando bloqueo"
        );
      }

      return res.json();
    }
};