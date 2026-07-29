import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { superAdminService } from "../services/superadmin.service";

export const useCrearLocal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: superAdminService.crearLocal,
    onSuccess: () => {
      toast.success("Local creado exitosamente");
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};