import { useEffect,useState } from "react";
import { dashboardService } from "../services/dashboard.service";
import type { ClienteHistorial } from "../types/dashboard.types";

export const useHistorialClientes =
  () => {

    const [clientes, setClientes] =
      useState<ClienteHistorial[]>([]);

    const [loading, setLoading] =
      useState(true);

    useEffect(() => {

      dashboardService
        .getHistorialClientes()
        .then(setClientes)
        .finally(() =>
          setLoading(false)
        );

    }, []);

    return {
      clientes,
      loading
    };
  };