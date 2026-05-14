import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { toast }
from "sonner";

import { configuracionService }
from "../services/configuracion.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useUpdateConfiguracion =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      configuracionService.actualizar,

    onSuccess: () => {

      toast.success(
        "Configuración guardada"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.configuracion.all,
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