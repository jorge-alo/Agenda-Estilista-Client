import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "../../../auth/auth.helpers";
import { toast } from "sonner";
import type { Turno } from "../types/agenda.types";

const API_URL = import.meta.env.VITE_API_URL;

const cancelarTurno = async (id: number) => {
  const res = await fetch(`${API_URL}/api/turnos/${id}/cancelar`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Error cancelando turno");
  }

  return res.json();
};

export const useCancelarTurno = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelarTurno,

    onMutate: async (id: number) => {
      // 🛑 Frenar refetchs en curso para no pisar el update optimista
      await queryClient.cancelQueries({ queryKey: ["turnos"] });

      // 📸 Guardar snapshot de TODAS las queries de turnos (lista + semana)
      const previousQueries = queryClient.getQueriesData<Turno[]>({
        queryKey: ["turnos"],
      });

      // ⚡ Actualizar optimistamente en todas las caches donde aparezca el turno
      queryClient.setQueriesData<Turno[]>({ queryKey: ["turnos"] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, estado: "cancelado" } : t))
      );

      return { previousQueries };
    },

    onError: (_err, _id, context) => {
      // ↩️ Revertir si falla
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Error cancelando turno");
    },

    onSuccess: () => {
      toast.success("Turno cancelado");
    },

    onSettled: () => {
      // 🔄 Sincronizar con el servidor pase lo que pase
      queryClient.invalidateQueries({ queryKey: ["turnos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};