import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { toast }
from "sonner";

import { horariosService }
from "../services/horarios.service";

import { queryKeys }
from "../../../../shared/lib/queryKeys";

export const useCrearHorario =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      horariosService.crear,

    onSuccess: (
      _,
      variables
    ) => {

      toast.success(
        "Horario creado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys
            .horarios
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