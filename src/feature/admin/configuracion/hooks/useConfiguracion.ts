import { useQuery }
from "@tanstack/react-query";

import { configuracionService }
from "../services/configuracion.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useConfiguracion =
() => {

  return useQuery({

    queryKey:
      queryKeys.configuracion.all,

    queryFn: () =>
      configuracionService.obtener(),

  });
};