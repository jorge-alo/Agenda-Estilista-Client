import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { toast }
  from "sonner";

import { reservarTurnoAdmin }
  from "../../../api/Admin.api";

import { queryKeys }
  from "../../../../shared/lib/queryKeys";

export const useReservarTurnoAdmin =
() => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      reservarTurnoAdmin,

    onSuccess: () => {

      toast.success(
        "Turno reservado con éxito"
      );

      queryClient.invalidateQueries({
        queryKey: ["turnos"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });

      queryClient.invalidateQueries({
        queryKey: ["disponibilidad-admin"],
      });

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.dashboard
            .clientes(),
      });

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.dashboard
            .reporteMensual(),
      });
    },

    onError: () => {

      toast.error(
        "Error al reservar turno"
      );
    },
  });
};