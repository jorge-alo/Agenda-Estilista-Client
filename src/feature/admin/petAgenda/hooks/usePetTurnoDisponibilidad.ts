import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { petTurnosService } from "../services/petTurnos.service";
import { isValidPetDate } from "../types/petTurno.types";

export function usePetTurnoDisponibilidad(turnoId: number, fecha: string, enabled: boolean) {
  const valid = enabled && Number.isInteger(turnoId) && turnoId > 0 && isValidPetDate(fecha);

  return useQuery({
    queryKey: queryKeys.petTurnoDisponibilidad.turnoFecha(turnoId, fecha),
    queryFn: () => petTurnosService.obtenerDisponibilidadReprogramacion(turnoId, fecha),
    enabled: valid,
  });
}
