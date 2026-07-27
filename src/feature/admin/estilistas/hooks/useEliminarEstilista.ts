import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { estilistasService } from "../services/estilistas.services";

export const useEliminarEstilista = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: estilistasService.eliminar,
    onSuccess: () => {
      toast.success("Estilista eliminado correctamente");
      queryClient.invalidateQueries({ queryKey: queryKeys.estilistas.all });
    },
    onError: (error: any) => {
      // Aquí se mostrará el mensaje del backend: "Tiene turnos activos futuros"
      toast.error(error.message || "Error al eliminar");
    },
  });
};