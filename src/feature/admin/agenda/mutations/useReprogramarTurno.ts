import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import {
  reprogramarTurno
} from "../services/agenda.service";

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

      queryClient.invalidateQueries({
        queryKey: ["turnos"]
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard"]
      });

    },

  });
};