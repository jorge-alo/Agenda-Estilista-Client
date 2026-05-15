import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { reservaService } from "../services/reserva.service";

export const useReservarTurno = () => {

  return useMutation({

    mutationFn:
      reservaService.reservar,

    onSuccess: () => {

      toast.success(
        "Turno reservado"
      );
    },

    onError: () => {

      toast.error(
        "Error reservando turno"
      );
    },
  });
};