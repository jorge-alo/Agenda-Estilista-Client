import { dashboardService } from "../services/dashboard.service";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys";

export const useHistorialClientes =
  () => {
    return useQuery({

      queryKey:
        queryKeys.dashboard.clientes(),

      queryFn: () =>
        dashboardService
          .getHistorialClientes(),

    });

  };