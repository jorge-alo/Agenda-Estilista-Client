import { fetchWithAuth } from "../../../shared/lib/fetchWithAuth"; // Ajusta la ruta a tu lib shared
import type { CrearLocalDTO, Local } from "../types/superadmin.types";

const API_URL = import.meta.env.VITE_API_URL;

export const superAdminService = {
  getLocales: async (): Promise<Local[]> => {
    const res = await fetchWithAuth(`${API_URL}/api/superadmin/locales`);
    if (!res.ok) throw new Error("Error cargando locales");
    return res.json();
  },

  crearLocal: async (data: CrearLocalDTO) => {
    const res = await fetchWithAuth(`${API_URL}/api/superadmin/register`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const responseData = await res.json();
    if (!res.ok) throw new Error(responseData.error || "Error al crear el local");
    return responseData;
  },

  toggleLocal: async (id: number) => {
    const res = await fetchWithAuth(`${API_URL}/api/superadmin/locales/${id}/toggle`, {
      method: "PATCH",
    });
    if (!res.ok) throw new Error("Error al cambiar el estado del local");
    return res.json();
  },

  eliminarLocal: async (id: number) => {
    const res = await fetchWithAuth(`${API_URL}/api/superadmin/locales/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Error al eliminar el local");
    return res.json();
  },
};