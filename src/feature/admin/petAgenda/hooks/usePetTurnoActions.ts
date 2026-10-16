import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { petTurnosService } from "../services/petTurnos.service";

export function usePetTurnoActions() {
  const queryClient = useQueryClient();
  const invalidateAgenda = () => queryClient.invalidateQueries({ queryKey: queryKeys.petTurnos.all });

  const cancelar = useMutation({
    mutationFn: petTurnosService.cancelar,
    onSuccess: () => toast.success("Turno PET cancelado"),
    onError: (error: Error) => toast.error(error.message || "No se pudo cancelar el turno PET"),
    onSettled: invalidateAgenda,
  });

  const completar = useMutation({
    mutationFn: petTurnosService.completar,
    onSuccess: () => toast.success("Turno PET completado"),
    onError: (error: Error) => toast.error(error.message || "No se pudo completar el turno PET"),
    onSettled: invalidateAgenda,
  });

  return { cancelar, completar };
}
