import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../../shared/lib/queryKeys";
import { petTurnosService } from "../services/petTurnos.service";
import type { ConsultaTurnosPet } from "../types/petTurno.types";

export function usePetTurnos(consulta: ConsultaTurnosPet) {
  const queryKey = "fecha" in consulta
    ? queryKeys.petTurnos.fecha(consulta.fecha)
    : queryKeys.petTurnos.rango(consulta.desde, consulta.hasta);

  return useQuery({
    queryKey,
    queryFn: () => petTurnosService.listar(consulta),
  });
}
