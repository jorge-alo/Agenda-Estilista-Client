import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { toast }
from "sonner";

import { serviciosService }
from "../services/servicios.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useDesasignarServicio =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      serviciosService.desasignar,

    onSuccess: (
      _,
      variables
    ) => {

      toast.success(
        "Servicio quitado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys
            .servicios
            .porEstilista(
              variables.estilista_id
            ),
      });
    },

    onError: (
      error: any
    ) => {

      toast.error(
        error.message
      );
    },
  });
};