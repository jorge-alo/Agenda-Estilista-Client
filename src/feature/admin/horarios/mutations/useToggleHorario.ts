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

export const useToggleHorario =
(
  estilistaId: number
) => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      horariosService.toggle,

    onSuccess: () => {

      toast.success(
        "Horario actualizado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys
            .horarios
            .porEstilista(
              estilistaId
            ),
      });
    },
  });
};