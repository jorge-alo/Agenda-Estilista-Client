import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { configuracionService } from "../services/configuracion.service";

export const useConfigurarMP = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: configuracionService.configurarMP,
    onSuccess: () => {
      toast.success("Token de Mercado Pago configurado correctamente");
      queryClient.invalidateQueries({ queryKey: ["configuracion-mp"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};