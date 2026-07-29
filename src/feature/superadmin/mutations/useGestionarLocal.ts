import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { superAdminService } from "../services/superadmin.service";

export const useToggleLocal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.toggleLocal,
    onSuccess: () => {
      toast.success("Estado del local actualizado");
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useEliminarLocal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.eliminarLocal,
    onSuccess: () => {
      toast.success("Local eliminado correctamente");
      queryClient.invalidateQueries({ queryKey: queryKeys.superadmin.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};