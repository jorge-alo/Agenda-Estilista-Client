import { useQuery } from "@tanstack/react-query";

import { obtenerTurnos }
  from "../../../api/Admin.api";

import type { Turno }
  from "../types/agenda.types";
import { queryKeys } from "../../../../shared/lib/queryKeys";

export const useTurnos = (
  fecha?: string,
  desde?: string,
  hasta?: string,
  enabled = true
) => {

  return useQuery<Turno[]>({

      queryKey:
      desde && hasta
        ? queryKeys.turnos.semana(
            desde,
            hasta
          )
        : queryKeys.turnos.lista(
            fecha
          ),
          
    queryFn: async () => {
      const data = await obtenerTurnos(
        fecha,
        desde,
        hasta
      );

      return Array.isArray(data)
        ? data
        : [];
    },
    enabled,
  });
};