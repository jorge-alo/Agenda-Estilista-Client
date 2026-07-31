import { fetchWithAuth }
from "../../../../shared/lib/fetchWithAuth";

import type {
  Configuracion
} from "../types/configuracion.types";

const API_URL =
  import.meta.env.VITE_API_URL;

export const configuracionService = {

  obtener:
    async (): Promise<Configuracion> => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/configuracion`
        );

      if (!res.ok) {
        throw new Error(
          "Error al obtener configuración"
        );
      }

      return res.json();
    },

  actualizar:
    async (
      data: Configuracion
    ) => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/configuracion`,
          {
            method: "PUT",

            body: JSON.stringify(data),
          }
        );

      if (!res.ok) {
        throw new Error(
          "Error al actualizar configuración"
        );
      }

      return res.json();
    },

      // ✅ NUEVO: Obtener estado de Mercado Pago
  obtenerEstadoMP: async () => {
    const res = await fetchWithAuth(`${API_URL}/api/configuracion/mercadopago/estado`);
    if (!res.ok) {
      throw new Error("Error al obtener estado de Mercado Pago");
    }
    return res.json();
  },

  // ✅ NUEVO: Configurar token de Mercado Pago
  configurarMP: async (mp_access_token: string) => {
    const res = await fetchWithAuth(`${API_URL}/api/configuracion/mercadopago`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mp_access_token }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Error al configurar Mercado Pago");
    }
    return data;
  },
};