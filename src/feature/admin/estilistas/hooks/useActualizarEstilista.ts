import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { estilistasService } from "../services/estilistas.services";

export const useActualizarEstilista = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: estilistasService.actualizar,
    onSuccess: () => {
      toast.success("Estilista actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: queryKeys.estilistas.all });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar");
    },
  });
};