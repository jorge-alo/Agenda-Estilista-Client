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

export const useEliminarServicio =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      serviciosService.eliminar,

    onSuccess: () => {

      toast.success(
        "Servicio eliminado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.servicios.all,
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