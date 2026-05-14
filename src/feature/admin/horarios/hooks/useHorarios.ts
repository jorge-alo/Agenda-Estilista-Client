import { useQuery }
from "@tanstack/react-query";

import { horariosService }
from "../services/horarios.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useHorarios =
(
  estilistaId: number | null
) => {

  return useQuery({

    queryKey:
      estilistaId
        ? queryKeys
            .horarios
            .porEstilista(
              estilistaId
            )
        : ["horarios"],

    queryFn: () =>
      horariosService
        .obtenerPorEstilista(
          estilistaId!
        ),

    enabled:
      !!estilistaId,
  });
};