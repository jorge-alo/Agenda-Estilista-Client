import { useQuery } from "@tanstack/react-query";
import { configuracionService } from "../services/configuracion.service";

export const useEstadoMP = () => {
  return useQuery({
    queryKey: ["configuracion-mp"],
    queryFn: configuracionService.obtenerEstadoMP,
  });
};