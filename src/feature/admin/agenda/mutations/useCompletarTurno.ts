import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import {
  completarTurno
} from "../services/agenda.service";

export const useCompletarTurno = () => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: completarTurno,

    onSuccess: () => {

      queryClient.invalidateQueries({
        queryKey: ["turnos"]
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard"]
      });

    },

  });
};