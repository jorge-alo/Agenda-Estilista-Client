import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { petTurnosService } from "../services/petTurnos.service";

export interface ReprogramarPetTurnoInput {
  turnoId: number;
  fecha: string;
  hora: string;
}

export function useReprogramarPetTurno() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ turnoId, fecha, hora }: ReprogramarPetTurnoInput) =>
      petTurnosService.reprogramar(turnoId, fecha, hora),
    onSuccess: async () => {
      toast.success("Turno PET reprogramado");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.petTurnos.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.petTurnoDisponibilidad.all }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "No se pudo reprogramar el turno PET"),
  });
}
