import { useMutation, useQueryClient} from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { estilistasService } from "../services/estilistas.services";

export const useCrearEstilista =
() => {

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn:
      estilistasService.crear,

    onSuccess: () => {
      toast.success(
        "Estilista creado"
      );

      queryClient.invalidateQueries({
        queryKey:
          queryKeys.estilistas.all,
      });
    },

    onError: (
      error: any
    ) => {

      toast.error(
        error.message
      );
    },
  });
};