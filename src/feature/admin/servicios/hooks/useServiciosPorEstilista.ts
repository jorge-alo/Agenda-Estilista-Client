import { useQuery }
from "@tanstack/react-query";

import { serviciosService }
from "../services/servicios.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useServiciosPorEstilista =
(
  estilistaId: number | null
) => {

  return useQuery({

    queryKey:
      estilistaId
        ? queryKeys
            .servicios
            .porEstilista(
              estilistaId
            )
        : ["servicios-estilista"],

    queryFn: () =>
      serviciosService
        .obtenerPorEstilista(
          estilistaId!
        ),

    enabled:
      !!estilistaId,
  });
};