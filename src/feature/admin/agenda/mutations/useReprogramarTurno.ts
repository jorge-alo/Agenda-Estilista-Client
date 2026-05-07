import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import {
  reprogramarTurno
} from "../services/agenda.service";
import { toast } from "sonner";

interface Payload {
  id: number;
  body: any;
}

export const useReprogramarTurno = () => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      body
    }: Payload) =>
      reprogramarTurno(id, body),

    onSuccess: () => {

      toast.success(
        "Turno reprogramado"
      );

      queryClient.invalidateQueries({
        queryKey: ["turnos"]
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard"]
      });

    },
    onError: (error: any) => {

      toast.error(
        error.message ||
        "Error reprogramando"
      );

    },

  });
};