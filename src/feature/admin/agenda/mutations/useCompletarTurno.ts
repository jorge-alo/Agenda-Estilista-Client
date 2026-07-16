import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completarTurno } from "../services/agenda.service";
import { toast } from "sonner";
import type { Turno } from "../types/agenda.types";

export const useCompletarTurno = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completarTurno,

    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["turnos"] });

      const previousQueries = queryClient.getQueriesData<Turno[]>({
        queryKey: ["turnos"],
      });

      queryClient.setQueriesData<Turno[]>({ queryKey: ["turnos"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, estado: "completado" } : t))
      );

      return { previousQueries };
    },

    onError: (_err, _id, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Error completando turno");
    },

    onSuccess: () => {
      toast.success("Turno completado");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["turnos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};