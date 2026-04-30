import { getAuthHeaders }
from "../../../auth/auth.helpers";

import type {
  ClienteHistorial,
  ReporteMensual,
  ResumenDia
} from "../types/dashboard.types";

const BASE_URL =
  import.meta.env.VITE_API_URL;

export const dashboardService = {

  getResumenDia:
    async (
      fecha: string
    ): Promise<ResumenDia> => {

      const res = await fetch(
        `${BASE_URL}/api/dashboard/resumen-dia?fecha=${fecha}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {
        throw new Error(
          "Error al cargar resumen"
        );
      }

      return res.json();
    },

  getHistorialClientes:
    async (): Promise<ClienteHistorial[]> => {

      const res = await fetch(
        `${BASE_URL}/api/dashboard/clientes`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {

        throw new Error(
          "Error al cargar clientes"
        );
      }

      return res.json();
    },

  getReporteMensual:
    async (): Promise<ReporteMensual> => {

      const res = await fetch(
        `${BASE_URL}/api/dashboard/reporte-mensual`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {

        throw new Error(
          "Error reporte mensual"
        );
      }

      return res.json();
    }
};