import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { toast }
from "sonner";

import { bloqueosService }
from "../services/bloqueos.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useEliminarBloqueo =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      bloqueosService.eliminarBloqueo,

    onSuccess: () => {

      toast.success(
        "Bloqueo eliminado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.bloqueos.all,
      });

      queryClient.invalidateQueries({
        queryKey:
          ["disponibilidad-admin"],
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