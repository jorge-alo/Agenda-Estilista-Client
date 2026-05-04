import { useQuery } from "@tanstack/react-query";

import { obtenerTurnos }
  from "../../../api/Admin.api";

import type { Turno }
  from "../types/agenda.types";

export const useTurnos = (
  fecha?: string,
  desde?: string,
  hasta?: string
) => {

  return useQuery<Turno[]>({

    queryKey: [
      "turnos",
      fecha,
      desde,
      hasta
    ],

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

  });
};