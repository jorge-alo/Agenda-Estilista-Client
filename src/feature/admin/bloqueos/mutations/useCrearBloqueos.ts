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

export const useCrearBloqueo =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      bloqueosService.crear,

    onSuccess: () => {

      toast.success(
        "Bloqueo creado"
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