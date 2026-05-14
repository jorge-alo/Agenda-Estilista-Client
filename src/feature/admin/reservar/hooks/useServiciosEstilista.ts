import { useQuery } from "@tanstack/react-query";

import { getServiciosPorEstilista } from "../services/reservar.service";
import { queryKeys } from "../../../../shared/lib/queryKeys";

export const useServiciosEstilista =
(
  estilistaId: number | null
) => {

  return useQuery({

     queryKey:
      queryKeys.servicios
        .porEstilista(
          estilistaId!
        ),

    queryFn: () =>
      getServiciosPorEstilista(
        estilistaId!
      ),

    enabled: !!estilistaId,
  });
};