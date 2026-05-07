import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import {
  completarTurno
} from "../services/agenda.service";
import { toast } from "sonner";

export const useCompletarTurno = () => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: completarTurno,

    onSuccess: () => {
      toast.success(
        "Turno completado"
      );

      queryClient.invalidateQueries({
        queryKey: ["turnos"]
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard"]
      });

    },
    onError: () => {

      toast.error(
        "Error completando turno"
      );

    },

  });
};