import { useQuery }
from "@tanstack/react-query";

import { obtenerServicios }
from "../../../api/Admin.api";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useServicios = () => {

  return useQuery({

    queryKey:
      queryKeys.servicios.all,

    queryFn:
      obtenerServicios,

  });

};