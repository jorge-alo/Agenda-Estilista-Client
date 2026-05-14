import { fetchWithAuth }
from "../../../../shared/lib/fetchWithAuth";

import type {
  CrearHorarioDTO
} from "../types/horarios.types";

const API_URL =
  import.meta.env.VITE_API_URL;

export const horariosService = {

  obtenerPorEstilista:
    async (
      estilistaId: number
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/horarios/${estilistaId}`
        );

      if (!res.ok) {
        throw new Error(
          "Error cargando horarios"
        );
      }

      return res.json();
    },

  crear:
    async (
      body: CrearHorarioDTO
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/horarios`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error
        );
      }

      return data;
    },

  toggle:
    async (
      id: number
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/horarios/${id}/toggle`,
          {
            method: "PATCH",
          }
        );

      return res.json();
    },
};