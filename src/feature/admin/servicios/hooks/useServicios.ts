import { useQuery }
from "@tanstack/react-query";

import { serviciosService }
from "../services/servicios.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useServicios =
() => {

  return useQuery({

    queryKey:
      queryKeys.servicios.all,

    queryFn: () =>
      serviciosService.obtener(),

  });
};