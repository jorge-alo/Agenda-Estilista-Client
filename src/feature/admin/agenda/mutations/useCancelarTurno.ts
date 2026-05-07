import {
  useMutation,
  useQueryClient
} from "@tanstack/react-query";

import { getAuthHeaders }
  from "../../../auth/auth.helpers";
import { toast } from "sonner";

const API_URL =
  import.meta.env.VITE_API_URL;

const cancelarTurno =
  async (id: number) => {

    const res = await fetch(
      `${API_URL}/api/turnos/${id}/cancelar`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      }
    );

    if (!res.ok) {
      throw new Error(
        "Error cancelando turno"
      );
    }

    return res.json();
  };

export const useCancelarTurno = () => {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: cancelarTurno,

    onSuccess: () => {

      toast.success(
        "Turno cancelado"
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
        "Error cancelando turno"
      );

    },

  });
};