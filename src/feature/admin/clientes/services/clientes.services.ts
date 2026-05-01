import { getAuthHeaders } from "../../../auth/auth.helpers";

const API_URL = import.meta.env.VITE_API_URL;

export const clientesService = {

  async getAll() {

    const res = await fetch(
      `${API_URL}/api/clientes`,
      {
        headers: getAuthHeaders()
      }
    );

    if (!res.ok) {
      throw new Error("Error obteniendo clientes");
    }

    return res.json();
  }

};