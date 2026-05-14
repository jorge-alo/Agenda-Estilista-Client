import { fetchWithAuth }
from "../../../../shared/lib/fetchWithAuth";
import type { AsignarServicioDTO, CrearServicioDTO } from "../types/services.types";


const API_URL =
  import.meta.env.VITE_API_URL;

export const serviciosService = {

  obtener:
    async () => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/admin`
        );

      if (!res.ok) {
        throw new Error(
          "Error cargando servicios"
        );
      }

      return res.json();
    },

  crear:
    async (
      body: CrearServicioDTO
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios`,
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

  eliminar:
    async (
      id: number
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/${id}`,
          {
            method: "DELETE",
          }
        );

      return res.json();
    },

  toggle:
    async (
      id: number
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/${id}/toggle`,
          {
            method: "PATCH",
          }
        );

      return res.json();
    },

  obtenerPorEstilista:
    async (
      estilistaId: number
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/estilista/${estilistaId}`
        );

      return res.json();
    },

  asignar:
    async (
      body: AsignarServicioDTO
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/asignar`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );

      return res.json();
    },

  desasignar:
    async (
      body: AsignarServicioDTO
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/servicios/desasignar`,
          {
            method: "DELETE",
            body: JSON.stringify(body),
          }
        );

      return res.json();
    },
};