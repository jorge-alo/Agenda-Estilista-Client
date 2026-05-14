import { fetchWithAuth }
from "../../../../shared/lib/fetchWithAuth";

import type {
  WhatsAppEstado,
  WhatsAppQR
} from "../types/whatsapp.types";

const API_URL =
  import.meta.env.VITE_API_URL;

export const whatsappService = {

  estado:
    async (
      localId: string
    ): Promise<WhatsAppEstado> => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/whatsapp/estado/${localId}`
        );

      if (!res.ok) {
        throw new Error(
          "Error verificando WhatsApp"
        );
      }

      return res.json();
    },

  generarQR:
    async (
      localId: string
    ): Promise<WhatsAppQR> => {

      const res =
        await fetchWithAuth(
          `${API_URL}/api/whatsapp/conectar/${localId}`
        );

      if (!res.ok) {
        throw new Error(
          "Error generando QR"
        );
      }

      return res.json();
    },
};