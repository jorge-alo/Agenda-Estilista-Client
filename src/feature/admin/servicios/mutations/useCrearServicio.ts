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

export const useCrearServicio =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      serviciosService.crear,

    onSuccess: () => {

      toast.success(
        "Servicio creado"
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